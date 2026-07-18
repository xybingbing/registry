//go:build !sync

package sync

import "context"

type BaseOnDemand struct{}

func (onDemand *BaseOnDemand) SyncImage(ctx context.Context, repo, reference string) error {
	return nil
}

func (onDemand *BaseOnDemand) SyncImageForHostPrefix(ctx context.Context, hostPrefix, repo, reference string) error {
	return nil
}

func (onDemand *BaseOnDemand) SyncImageForHostPrefixForced(ctx context.Context, hostPrefix, repo, reference string) error {
	return nil
}

func (onDemand *BaseOnDemand) SyncReferrers(ctx context.Context, repo string,
	subjectDigestStr string, referenceTypes []string,
) error {
	return nil
}

func (onDemand *BaseOnDemand) SyncReferrersForHostPrefix(ctx context.Context, hostPrefix, repo string,
	subjectDigestStr string, referenceTypes []string,
) error {
	return nil
}
