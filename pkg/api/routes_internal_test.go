package api

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	godigest "github.com/opencontainers/go-digest"
	ispec "github.com/opencontainers/image-spec/specs-go/v1"

	zerr "zotregistry.dev/zot/v2/errors"
	"zotregistry.dev/zot/v2/pkg/api/config"
	extconf "zotregistry.dev/zot/v2/pkg/extensions/config"
	syncconf "zotregistry.dev/zot/v2/pkg/extensions/config/sync"
	"zotregistry.dev/zot/v2/pkg/log"
	"zotregistry.dev/zot/v2/pkg/storage"
	storageTypes "zotregistry.dev/zot/v2/pkg/storage/types"
	"zotregistry.dev/zot/v2/pkg/test/mocks"
)

type syncOnDemandStub struct {
	syncImageForHostPrefix       func(ctx context.Context, hostPrefix, repo, reference string) error
	syncImageForHostPrefixForced func(ctx context.Context, hostPrefix, repo, reference string) error
}

func (stub *syncOnDemandStub) SyncImage(ctx context.Context, repo, reference string) error {
	return stub.SyncImageForHostPrefix(ctx, "", repo, reference)
}

func (stub *syncOnDemandStub) SyncImageForHostPrefix(ctx context.Context, hostPrefix, repo, reference string) error {
	if stub.syncImageForHostPrefix != nil {
		return stub.syncImageForHostPrefix(ctx, hostPrefix, repo, reference)
	}

	return nil
}

func (stub *syncOnDemandStub) SyncImageForHostPrefixForced(
	ctx context.Context, hostPrefix, repo, reference string,
) error {
	if stub.syncImageForHostPrefixForced != nil {
		return stub.syncImageForHostPrefixForced(ctx, hostPrefix, repo, reference)
	}

	return nil
}

func (stub *syncOnDemandStub) SyncReferrers(_ context.Context, _, _ string,
	_ []string,
) error {
	return nil
}

func (stub *syncOnDemandStub) SyncReferrersForHostPrefix(_ context.Context, _, _, _ string,
	_ []string,
) error {
	return nil
}

func newSyncEnabledController(syncOnDemand SyncOnDemand) *Controller {
	enabled := true
	conf := config.New()
	conf.Extensions = &extconf.ExtensionConfig{
		Sync: &syncconf.Config{Enable: &enabled},
	}

	return &Controller{
		Config:       conf,
		SyncOnDemand: syncOnDemand,
		Log:          log.NewLogger("error", ""),
	}
}

func TestGetImageManifestRefreshesSinglePlatformTag(t *testing.T) {
	t.Parallel()

	oldContent := []byte(`{"mediaType":"application/vnd.oci.image.manifest.v1+json",` +
		`"config":{"mediaType":"application/vnd.oci.image.config.v1+json"}}`)
	newContent := []byte(`{"mediaType":"application/vnd.oci.image.index.v1+json"}`)
	oldDigest := godigest.FromBytes(oldContent)
	newDigest := godigest.FromBytes(newContent)
	getCalls := 0
	syncCalls := 0

	imgStore := &mocks.MockedImageStore{
		GetImageManifestFn: func(repo, reference string) ([]byte, godigest.Digest, string, error) {
			getCalls++
			if getCalls == 1 {
				return oldContent, oldDigest, ispec.MediaTypeImageManifest, nil
			}

			return newContent, newDigest, ispec.MediaTypeImageIndex, nil
		},
	}

	syncStub := &syncOnDemandStub{
		syncImageForHostPrefixForced: func(_ context.Context, hostPrefix, repo, reference string) error {
			syncCalls++
			if hostPrefix != "docker" || repo != "library/redis" || reference != "8-alpine" {
				t.Fatalf("unexpected sync request: hostPrefix=%q repo=%q reference=%q", hostPrefix, repo, reference)
			}

			return nil
		},
	}
	routeHandler := &RouteHandler{c: newSyncEnabledController(syncStub)}

	content, digest, mediaType, err := getImageManifest(context.Background(), routeHandler, imgStore,
		"library/redis", "8-alpine", "docker")
	if err != nil {
		t.Fatalf("getImageManifest() error = %v", err)
	}

	if string(content) != string(newContent) || digest != newDigest || mediaType != ispec.MediaTypeImageIndex {
		t.Fatalf("expected refreshed index, got digest=%q mediaType=%q content=%s", digest, mediaType, content)
	}

	if syncCalls != 1 || getCalls != 2 {
		t.Fatalf("expected one sync and two local reads, got sync=%d reads=%d", syncCalls, getCalls)
	}
}

func TestGetImageManifestServesLocalImageWhenUpstreamDoesNotExist(t *testing.T) {
	t.Parallel()

	localContent := []byte(`{"mediaType":"application/vnd.docker.distribution.manifest.v2+json"}`)
	localDigest := godigest.FromBytes(localContent)
	getCalls := 0

	imgStore := &mocks.MockedImageStore{
		GetImageManifestFn: func(repo, reference string) ([]byte, godigest.Digest, string, error) {
			getCalls++

			return localContent, localDigest, "application/vnd.docker.distribution.manifest.v2+json", nil
		},
	}

	syncStub := &syncOnDemandStub{
		syncImageForHostPrefixForced: func(_ context.Context, hostPrefix, repo, reference string) error {
			return zerr.ErrManifestNotFound
		},
	}
	routeHandler := &RouteHandler{c: newSyncEnabledController(syncStub)}

	content, digest, mediaType, err := getImageManifest(context.Background(), routeHandler, imgStore,
		"redis", "8-alpine", "")
	if err != nil {
		t.Fatalf("getImageManifest() error = %v", err)
	}

	if string(content) != string(localContent) || digest != localDigest ||
		mediaType != "application/vnd.docker.distribution.manifest.v2+json" {
		t.Fatalf("expected local manifest fallback, got digest=%q mediaType=%q content=%s", digest, mediaType, content)
	}

	if getCalls != 1 {
		t.Fatalf("expected one local read when upstream is missing, got %d", getCalls)
	}
}

func TestGetImageManifestReturnsSinglePlatformSyncFailure(t *testing.T) {
	t.Parallel()

	localContent := []byte(`{"mediaType":"application/vnd.oci.image.manifest.v1+json",` +
		`"config":{"mediaType":"application/vnd.oci.image.config.v1+json"}}`)
	localDigest := godigest.FromBytes(localContent)
	syncErr := errors.New("upstream unavailable")
	imgStore := &mocks.MockedImageStore{
		GetImageManifestFn: func(repo, reference string) ([]byte, godigest.Digest, string, error) {
			return localContent, localDigest, ispec.MediaTypeImageManifest, nil
		},
	}
	syncStub := &syncOnDemandStub{
		syncImageForHostPrefixForced: func(_ context.Context, hostPrefix, repo, reference string) error {
			return syncErr
		},
	}
	routeHandler := &RouteHandler{c: newSyncEnabledController(syncStub)}

	_, _, _, err := getImageManifest(context.Background(), routeHandler, imgStore,
		"redis", "8-alpine", "")
	if !errors.Is(err, syncErr) {
		t.Fatalf("expected sync failure %v, got %v", syncErr, err)
	}
}

func TestGetImageManifestServesLocalOCIArtifactWithoutSync(t *testing.T) {
	t.Parallel()

	localContent := []byte(`{"schemaVersion":2,"mediaType":"application/vnd.oci.image.manifest.v1+json",` +
		`"config":{"mediaType":"application/vnd.cncf.helm.config.v1+json"}}`)
	localDigest := godigest.FromBytes(localContent)
	syncCalls := 0
	imgStore := &mocks.MockedImageStore{
		GetImageManifestFn: func(repo, reference string) ([]byte, godigest.Digest, string, error) {
			return localContent, localDigest, ispec.MediaTypeImageManifest, nil
		},
	}
	syncStub := &syncOnDemandStub{
		syncImageForHostPrefixForced: func(_ context.Context, hostPrefix, repo, reference string) error {
			syncCalls++

			return errors.New("OCI artifact must not trigger image synchronization")
		},
	}
	routeHandler := &RouteHandler{c: newSyncEnabledController(syncStub)}

	content, digest, mediaType, err := getImageManifest(context.Background(), routeHandler, imgStore,
		"helm/gitea-drone", "0.1.0", "")
	if err != nil {
		t.Fatalf("getImageManifest() error = %v", err)
	}
	if string(content) != string(localContent) || digest != localDigest || mediaType != ispec.MediaTypeImageManifest {
		t.Fatalf("expected local Helm manifest, got digest=%q mediaType=%q content=%s", digest, mediaType, content)
	}
	if syncCalls != 0 {
		t.Fatalf("expected no sync for OCI artifact, got %d calls", syncCalls)
	}
}

func TestGetImageManifestServesLocalIndexWhenUpstreamRefreshFails(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		syncErr error
	}{
		{
			name:    "upstream image does not exist",
			syncErr: zerr.ErrRepoNotFound,
		},
		{
			name:    "upstream is unavailable",
			syncErr: errors.New("upstream unavailable"),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			localContent := []byte(`{"mediaType":"application/vnd.oci.image.index.v1+json"}`)
			localDigest := godigest.FromBytes(localContent)
			getCalls := 0
			imgStore := &mocks.MockedImageStore{
				GetImageManifestFn: func(repo, reference string) ([]byte, godigest.Digest, string, error) {
					getCalls++

					return localContent, localDigest, ispec.MediaTypeImageIndex, nil
				},
			}
			syncStub := &syncOnDemandStub{
				syncImageForHostPrefix: func(_ context.Context, hostPrefix, repo, reference string) error {
					return test.syncErr
				},
			}
			routeHandler := &RouteHandler{c: newSyncEnabledController(syncStub)}

			content, digest, mediaType, err := getImageManifest(context.Background(), routeHandler, imgStore,
				"redis", "latest", "")
			if err != nil {
				t.Fatalf("getImageManifest() error = %v", err)
			}
			if string(content) != string(localContent) || digest != localDigest || mediaType != ispec.MediaTypeImageIndex {
				t.Fatalf("expected local index fallback, got digest=%q mediaType=%q content=%s",
					digest, mediaType, content)
			}
			if getCalls != 1 {
				t.Fatalf("expected one local read after upstream refresh failure, got %d", getCalls)
			}
		})
	}
}

func TestGetImageManifestRefreshesIndexesBeforeReturning(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		mediaType string
	}{
		{
			name:      "OCI image index tag",
			mediaType: ispec.MediaTypeImageIndex,
		},
		{
			name:      "Docker manifest list tag",
			mediaType: "application/vnd.docker.distribution.manifest.list.v2+json",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			oldContent := []byte("old " + test.name)
			newContent := []byte("new " + test.name)
			oldDigest := godigest.FromBytes(oldContent)
			newDigest := godigest.FromBytes(newContent)
			getCalls := 0
			syncCompleted := false
			imgStore := &mocks.MockedImageStore{
				GetImageManifestFn: func(repo, reference string) ([]byte, godigest.Digest, string, error) {
					getCalls++
					if getCalls == 1 {
						return oldContent, oldDigest, test.mediaType, nil
					}
					if !syncCompleted {
						t.Fatal("refreshed index was read before upstream sync completed")
					}

					return newContent, newDigest, test.mediaType, nil
				},
			}
			syncStub := &syncOnDemandStub{
				syncImageForHostPrefix: func(_ context.Context, hostPrefix, repo, reference string) error {
					if hostPrefix != "docker" || repo != "repo" || reference != "latest" {
						t.Fatalf("unexpected sync request: hostPrefix=%q repo=%q reference=%q", hostPrefix, repo, reference)
					}
					syncCompleted = true

					return nil
				},
			}
			routeHandler := &RouteHandler{c: newSyncEnabledController(syncStub)}

			gotContent, gotDigest, gotMediaType, err := getImageManifest(context.Background(), routeHandler, imgStore,
				"repo", "latest", "docker")
			if err != nil {
				t.Fatalf("getImageManifest() error = %v", err)
			}

			if string(gotContent) != string(newContent) || gotDigest != newDigest || gotMediaType != test.mediaType {
				t.Fatalf("expected refreshed index, got digest=%q mediaType=%q content=%s",
					gotDigest, gotMediaType, gotContent)
			}

			if getCalls != 2 || !syncCompleted {
				t.Fatalf("expected sync followed by a second local read, got reads=%d syncCompleted=%t",
					getCalls, syncCompleted)
			}
		})
	}
}

func TestGetImageManifestDoesNotRefreshDigestReference(t *testing.T) {
	t.Parallel()

	content := []byte(`{"mediaType":"application/vnd.oci.image.manifest.v1+json"}`)
	digest := godigest.FromBytes(content)
	syncCalls := 0
	imgStore := &mocks.MockedImageStore{
		GetImageManifestFn: func(repo, reference string) ([]byte, godigest.Digest, string, error) {
			return content, digest, ispec.MediaTypeImageManifest, nil
		},
	}
	syncStub := &syncOnDemandStub{
		syncImageForHostPrefixForced: func(_ context.Context, hostPrefix, repo, reference string) error {
			syncCalls++

			return nil
		},
	}
	routeHandler := &RouteHandler{c: newSyncEnabledController(syncStub)}

	_, _, _, err := getImageManifest(context.Background(), routeHandler, imgStore,
		"repo", godigest.FromString("child-manifest").String(), "")
	if err != nil {
		t.Fatalf("getImageManifest() error = %v", err)
	}

	if syncCalls != 0 {
		t.Fatalf("expected no sync, got %d calls", syncCalls)
	}
}

func TestParseRangeHeader(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		header  string
		size    int64
		want    []httpRange
		wantErr bool
	}{
		{
			name:   "open ended range",
			header: "bytes=0-",
			size:   10,
			want:   []httpRange{{start: 0, end: 9}},
		},
		{
			name:   "range end is capped to size",
			header: "bytes=0-100",
			size:   10,
			want:   []httpRange{{start: 0, end: 9}},
		},
		{
			name:   "suffix range",
			header: "bytes=-3",
			size:   10,
			want:   []httpRange{{start: 7, end: 9}},
		},
		{
			name:   "oversized suffix range returns whole blob",
			header: "bytes=-100",
			size:   10,
			want:   []httpRange{{start: 0, end: 9}},
		},
		{
			name:   "ranges are sorted",
			header: "bytes=7-8, 0-1",
			size:   10,
			want: []httpRange{
				{start: 0, end: 1},
				{start: 7, end: 8},
			},
		},
		{
			name:   "overlapping and adjacent ranges are coalesced",
			header: "bytes=0-2,3-4,6-8,7-9",
			size:   10,
			want: []httpRange{
				{start: 0, end: 4},
				{start: 6, end: 9},
			},
		},
		{name: "zero size", header: "bytes=0-", wantErr: true},
		{name: "wrong unit", header: "byte=0-1", size: 10, wantErr: true},
		{name: "empty range set", header: "bytes=", size: 10, wantErr: true},
		{name: "empty range spec", header: "bytes=0-1,", size: 10, wantErr: true},
		{name: "zero suffix", header: "bytes=-0", size: 10, wantErr: true},
		{name: "bad suffix", header: "bytes=-x", size: 10, wantErr: true},
		{name: "bad start", header: "bytes=x-1", size: 10, wantErr: true},
		{name: "bad end", header: "bytes=1-x", size: 10, wantErr: true},
		{name: "inverted range", header: "bytes=2-1", size: 10, wantErr: true},
		{name: "range starts at size", header: "bytes=10-", size: 10, wantErr: true},
		{name: "range without dash", header: "bytes=0", size: 10, wantErr: true},
		{
			name:    "too many ranges",
			header:  "bytes=" + strings.TrimSuffix(strings.Repeat("0-0,", maxRangeSpecCount+1), ","),
			size:    10,
			wantErr: true,
		},
	}

	for _, test := range tests {
		test := test

		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseRangeHeader(test.header, test.size)
			if test.wantErr {
				if err == nil {
					t.Fatal("expected parse error")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected parse error: %v", err)
			}

			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("expected ranges %v, got %v", test.want, got)
			}
		})
	}
}

func TestNormalizeBlobRedirectURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		rawURL  string
		wantURL string
		wantOK  bool
	}{
		{
			name:    "preserves signed url bytes unchanged",
			rawURL:  "HTTPS://storage.example.com/blob?X-Amz-Signature=a%2Fb%2Bc",
			wantURL: "HTTPS://storage.example.com/blob?X-Amz-Signature=a%2Fb%2Bc",
			wantOK:  true,
		},
		{
			name:    "allows http scheme",
			rawURL:  "http://storage.example.com/blob",
			wantURL: "http://storage.example.com/blob",
			wantOK:  true,
		},
		{
			name:   "rejects disallowed scheme",
			rawURL: "javascript:alert(1)",
			wantOK: false,
		},
		{
			name:   "rejects parse failure",
			rawURL: "https://storage.example.com/%zz",
			wantOK: false,
		},
		{
			name:   "rejects missing host",
			rawURL: "https:///blob",
			wantOK: false,
		},
		{
			name:   "rejects crlf injection",
			rawURL: "https://storage.example.com/blob?sig=abc\r\nX-Test: y",
			wantOK: false,
		},
	}

	for _, test := range tests {
		test := test

		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			gotURL, gotOK := normalizeBlobRedirectURL(test.rawURL)
			if gotOK != test.wantOK {
				t.Fatalf("expected ok=%v, got %v", test.wantOK, gotOK)
			}

			if gotURL != test.wantURL {
				t.Fatalf("expected url %q, got %q", test.wantURL, gotURL)
			}
		})
	}
}

func TestIsBlobRedirectEnabled(t *testing.T) {
	t.Parallel()

	routeHandler := &RouteHandler{
		c: &Controller{
			Config: &config.Config{
				Storage: config.GlobalStorageConfig{
					StorageConfig: config.StorageConfig{
						RedirectBlobURL: false,
					},
					SubPaths: map[string]config.StorageConfig{
						"/a": {
							RedirectBlobURL: true,
						},
					},
				},
			},
			StoreController: storage.StoreController{
				SubStore: map[string]storageTypes.ImageStore{
					"/a": nil,
				},
			},
		},
	}

	if !routeHandler.isBlobRedirectEnabled("a/repo") {
		t.Fatal("expected redirect to be enabled for /a subpath repo")
	}

	// Default storage remains disabled even when a specific subpath enables redirect.
	if routeHandler.isBlobRedirectEnabled("b/repo") {
		t.Fatal("expected redirect to be disabled for default storage")
	}
}
