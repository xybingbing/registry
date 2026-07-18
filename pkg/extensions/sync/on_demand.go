//go:build sync

package sync

import (
	"context"
	"errors"
	"sync"
	"time"

	zerr "zotregistry.dev/zot/v2/errors"
	"zotregistry.dev/zot/v2/pkg/common"
	"zotregistry.dev/zot/v2/pkg/log"
)

type request struct {
	hostPrefix string
	repo       string
	reference  string
	force      bool
	// used for background retries, at most one background retry per service
	serviceID    int
	isBackground bool
}

/*
BaseOnDemand tracks requests that can be an image/signature/sbom.

It keeps track of all parallel requests, if two requests of same image/signature/sbom comes at the same time,
process just the first one, also keep track of all background retrying routines.
*/
type BaseOnDemand struct {
	services []Service
	// map[request]chan err
	requestStore *sync.Map
	log          log.Logger
}

func NewOnDemand(log log.Logger) *BaseOnDemand {
	return &BaseOnDemand{log: log, requestStore: &sync.Map{}}
}

func (onDemand *BaseOnDemand) Add(service Service) {
	onDemand.services = append(onDemand.services, service)
}

func (onDemand *BaseOnDemand) SyncImage(ctx context.Context, repo, reference string) error {
	return onDemand.SyncImageForHostPrefix(ctx, "", repo, reference)
}

func (onDemand *BaseOnDemand) SyncImageForHostPrefix(ctx context.Context, hostPrefix, repo, reference string) error {
	return onDemand.syncImageForHostPrefix(ctx, hostPrefix, repo, reference, false)
}

func (onDemand *BaseOnDemand) SyncImageForHostPrefixForced(ctx context.Context, hostPrefix, repo, reference string) error {
	return onDemand.syncImageForHostPrefix(ctx, hostPrefix, repo, reference, true)
}

func (onDemand *BaseOnDemand) syncImageForHostPrefix(ctx context.Context, hostPrefix, repo, reference string,
	force bool,
) error {
	req := request{
		hostPrefix: hostPrefix,
		repo:       repo,
		reference:  reference,
		force:      force,
	}

	syncResult := make(chan error)
	val, loaded := onDemand.requestStore.LoadOrStore(req, syncResult)

	if loaded {
		onDemand.log.Info().Str("repo", repo).Str("reference", reference).
			Msg("image already demanded, waiting on channel")

		syncResult, _ := val.(chan error)

		err := <-syncResult

		return err
	}

	defer onDemand.requestStore.Delete(req)

	go onDemand.syncImage(ctx, hostPrefix, repo, reference, force, syncResult)

	err := <-syncResult

	return err
}

func (onDemand *BaseOnDemand) SyncReferrers(ctx context.Context, repo string,
	subjectDigestStr string, referenceTypes []string,
) error {
	return onDemand.SyncReferrersForHostPrefix(ctx, "", repo, subjectDigestStr, referenceTypes)
}

func (onDemand *BaseOnDemand) SyncReferrersForHostPrefix(ctx context.Context, hostPrefix, repo string,
	subjectDigestStr string, referenceTypes []string,
) error {
	req := request{
		hostPrefix: hostPrefix,
		repo:       repo,
		reference:  subjectDigestStr,
	}

	syncResult := make(chan error)
	val, loaded := onDemand.requestStore.LoadOrStore(req, syncResult)

	if loaded {
		onDemand.log.Info().Str("repo", repo).Str("reference", subjectDigestStr).
			Msg("referrers for image already demanded, waiting on channel")

		syncResult, _ := val.(chan error)

		err := <-syncResult

		return err
	}

	defer onDemand.requestStore.Delete(req)

	go onDemand.syncReferrers(ctx, hostPrefix, repo, subjectDigestStr, referenceTypes, syncResult)

	err := <-syncResult

	return err
}

type hostPrefixMatcher interface {
	MatchesHostPrefix(hostPrefix string) bool
}

func serviceMatchesHostPrefix(service Service, hostPrefix string) bool {
	matcher, ok := service.(hostPrefixMatcher)
	if !ok {
		return hostPrefix == ""
	}

	return matcher.MatchesHostPrefix(hostPrefix)
}

func (onDemand *BaseOnDemand) syncReferrers(ctx context.Context, hostPrefix, repo, subjectDigestStr string,
	referenceTypes []string, syncResult chan error,
) {
	defer close(syncResult)

	var err error
	effectiveHostPrefix := hostPrefix

retry:
	attemptedService := false

	for serviceID, service := range onDemand.services {
		if !serviceMatchesHostPrefix(service, effectiveHostPrefix) {
			continue
		}

		attemptedService = true
		timeout := service.GetSyncTimeout()

		onDemand.log.Debug().
			Str("hostPrefix", effectiveHostPrefix).
			Str("repo", repo).
			Str("reference", subjectDigestStr).
			Int("serviceID", serviceID).
			Dur("timeout", timeout).
			Msg("starting on-demand referrer sync")

		// Create a detached context with timeout to ensure sync completes even if HTTP client disconnects.
		// This prevents Kubernetes timeout/retries from aborting in-progress referrer downloads.
		syncCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), timeout)
		err = service.SyncReferrers(syncCtx, repo, subjectDigestStr, referenceTypes)

		cancel()

		if err != nil {
			if errors.Is(err, zerr.ErrManifestNotFound) ||
				errors.Is(err, zerr.ErrSyncImageFilteredOut) ||
				errors.Is(err, zerr.ErrSyncImageNotSigned) ||
				errors.Is(err, zerr.ErrRepoNotFound) ||
				// some public registries may return 401 for not found.
				errors.Is(err, zerr.ErrUnauthorizedAccess) {
				continue
			}

			req := request{
				hostPrefix:   effectiveHostPrefix,
				repo:         repo,
				reference:    subjectDigestStr,
				serviceID:    serviceID,
				isBackground: true,
			}

			// if there is already a background routine, skip
			if _, requested := onDemand.requestStore.LoadOrStore(req, struct{}{}); requested {
				continue
			}

			if service.CanRetryOnError() {
				retryErr := err

				// retry in background
				go func(service Service, serviceTimeout time.Duration) {
					// remove image after syncing
					defer func() {
						onDemand.requestStore.Delete(req)
						onDemand.log.Info().Str("repo", repo).Str("reference", subjectDigestStr).
							Msg("sync routine for image exited")
					}()

					onDemand.log.Info().Str("repo", repo).Str("reference", subjectDigestStr).Str("err", retryErr.Error()).
						Msg("sync routine: starting routine to copy image, because of error")

					// Use detached context with timeout for background retry
					retryCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), serviceTimeout)
					defer cancel()

					err := service.SyncReferrers(retryCtx, repo, subjectDigestStr, referenceTypes)
					if err != nil {
						onDemand.log.Error().Str("errorType", common.TypeOf(err)).Str("repo", repo).Str("reference", subjectDigestStr).
							Err(err).Msg("sync routine: starting routine to retry copy image due to error")
					}
				}(service, timeout)
			}
		} else {
			break
		}
	}

	if !attemptedService && effectiveHostPrefix != "" {
		effectiveHostPrefix = ""
		goto retry
	}

	if !attemptedService {
		err = zerr.ErrSyncImageFilteredOut
	}

	syncResult <- err
}

func (onDemand *BaseOnDemand) syncImage(ctx context.Context, hostPrefix, repo, reference string, force bool,
	syncResult chan error,
) {
	defer close(syncResult)

	var err error
	effectiveHostPrefix := hostPrefix

retry:
	attemptedService := false

	for serviceID, service := range onDemand.services {
		if !serviceMatchesHostPrefix(service, effectiveHostPrefix) {
			continue
		}

		attemptedService = true
		timeout := service.GetSyncTimeout()

		onDemand.log.Debug().
			Str("hostPrefix", effectiveHostPrefix).
			Str("repo", repo).
			Str("reference", reference).
			Int("serviceID", serviceID).
			Dur("timeout", timeout).
			Msg("starting on-demand image sync")

		// Create a detached context with timeout to ensure sync completes even if HTTP client disconnects.
		// This prevents Kubernetes timeout/retries from aborting in-progress image downloads.
		syncCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), timeout)
		err = syncServiceImage(service, syncCtx, repo, reference, force)

		cancel()

		if err != nil {
			if errors.Is(err, zerr.ErrManifestNotFound) ||
				errors.Is(err, zerr.ErrSyncImageFilteredOut) ||
				errors.Is(err, zerr.ErrSyncImageNotSigned) ||
				errors.Is(err, zerr.ErrRepoNotFound) ||
				// some public registries may return 401 for not found.
				errors.Is(err, zerr.ErrUnauthorizedAccess) {
				continue
			}

			req := request{
				hostPrefix:   effectiveHostPrefix,
				repo:         repo,
				reference:    reference,
				force:        force,
				serviceID:    serviceID,
				isBackground: true,
			}

			// if there is already a background routine, skip
			if _, requested := onDemand.requestStore.LoadOrStore(req, struct{}{}); requested {
				continue
			}

			if service.CanRetryOnError() {
				retryErr := err

				// retry in background
				go func(service Service, serviceTimeout time.Duration) {
					// remove image after syncing
					defer func() {
						onDemand.requestStore.Delete(req)
						onDemand.log.Info().Str("repo", repo).Str("reference", reference).
							Msg("sync routine for image exited")
					}()

					onDemand.log.Info().Str("repo", repo).Str("reference", reference).Str("err", retryErr.Error()).
						Msg("sync routine: starting routine to retry copy image due to error")

					// Use detached context with timeout for background retry
					retryCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), serviceTimeout)
					defer cancel()

					err := syncServiceImage(service, retryCtx, repo, reference, force)
					if err != nil {
						onDemand.log.Error().Str("errorType", common.TypeOf(err)).Str("repo", repo).Str("reference", reference).
							Err(err).Msg("sync routine: error while copying image")
					}
				}(service, timeout)
			}
		} else {
			break
		}
	}

	if !attemptedService && effectiveHostPrefix != "" {
		effectiveHostPrefix = ""
		goto retry
	}

	if !attemptedService {
		err = zerr.ErrSyncImageFilteredOut
	}

	syncResult <- err
}

func syncServiceImage(service Service, ctx context.Context, repo, reference string, force bool) error {
	if force {
		return service.SyncImageForced(ctx, repo, reference)
	}

	return service.SyncImage(ctx, repo, reference)
}
