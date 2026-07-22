package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"

	"zotregistry.dev/zot/v2/pkg/api/config"
	"zotregistry.dev/zot/v2/pkg/api/constants"
)

func TestRegistryTokenPermissions(t *testing.T) {
	t.Parallel()

	conf := config.New()
	conf.HTTP.Auth = &config.AuthConfig{
		HTPasswd: config.AuthHTPasswd{Path: "/unused-in-unit-test"},
	}
	conf.HTTP.AccessControl = &config.AccessControlConfig{
		Repositories: config.Repositories{
			"**": {
				AnonymousPolicy: []string{"read"},
				DefaultPolicy:   []string{"read", "create", "update", "delete"},
			},
		},
	}

	controller := NewController(conf)
	hash, err := bcrypt.GenerateFromPassword([]byte("secret"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	controller.HTPasswd.credMap["writer"] = string(hash)

	tokenAuth, err := newRegistryTokenAuth(controller)
	if err != nil {
		t.Fatal(err)
	}

	t.Run("anonymous token grants pull only", func(t *testing.T) {
		token := requestRegistryToken(t, tokenAuth, "", "", "repository:team/image:pull,push,delete")

		if err := tokenAuth.authorizer.Authorize(t.Context(), "Bearer "+token,
			&ResourceAction{Type: "repository", Name: "team/image", Action: "pull"}); err != nil {
			t.Fatalf("anonymous pull token was rejected: %v", err)
		}

		if err := tokenAuth.authorizer.Authorize(t.Context(), "Bearer "+token,
			&ResourceAction{Type: "repository", Name: "team/image", Action: "push"}); err == nil {
			t.Fatal("anonymous token unexpectedly grants push")
		}

		if err := tokenAuth.authorizer.Authorize(t.Context(), "Bearer "+token,
			&ResourceAction{Type: "repository", Name: "team/image", Action: "delete"}); err == nil {
			t.Fatal("anonymous token unexpectedly grants delete")
		}
	})

	t.Run("authenticated token grants configured write actions", func(t *testing.T) {
		token := requestRegistryToken(t, tokenAuth, "writer", "secret", "repository:team/image:pull,push,delete")

		for _, action := range []string{"pull", "push", "delete"} {
			if err := tokenAuth.authorizer.Authorize(t.Context(), "Bearer "+token,
				&ResourceAction{Type: "repository", Name: "team/image", Action: action}); err != nil {
				t.Fatalf("authenticated %s token was rejected: %v", action, err)
			}
		}
	})

	t.Run("buildkit oauth form grants configured write actions", func(t *testing.T) {
		token := requestRegistryTokenOAuth(t, tokenAuth, "writer", "secret",
			"repository:team/image:pull,push,delete")

		for _, action := range []string{"pull", "push", "delete"} {
			if err := tokenAuth.authorizer.Authorize(t.Context(), "Bearer "+token,
				&ResourceAction{Type: "repository", Name: "team/image", Action: action}); err != nil {
				t.Fatalf("BuildKit OAuth %s token was rejected: %v", action, err)
			}
		}
	})

	t.Run("invalid credentials are rejected", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet,
			"http://registry.test/zot/auth/token?scope=repository:team/image:push", nil)
		request.SetBasicAuth("writer", "wrong")
		response := httptest.NewRecorder()

		tokenAuth.TokenHandler()(response, request)

		if response.Code != http.StatusUnauthorized {
			t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
		}
	})

	t.Run("invalid buildkit oauth credentials are rejected", func(t *testing.T) {
		form := url.Values{
			"grant_type": {"password"},
			"username":   {"writer"},
			"password":   {"wrong"},
			"scope":      {"repository:team/image:pull,push"},
		}
		request := httptest.NewRequest(http.MethodPost, "http://registry.test/zot/auth/token",
			strings.NewReader(form.Encode()))
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		response := httptest.NewRecorder()

		tokenAuth.TokenHandler()(response, request)

		if response.Code != http.StatusUnauthorized {
			t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
		}
	})
}

func TestRegistryTokenChallengeRealm(t *testing.T) {
	t.Parallel()

	controller := NewController(config.New())
	tokenAuth, err := newRegistryTokenAuth(controller)
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodGet, "http://registry.internal/v2/", nil)
	request.Host = "registry.example.com"
	request.Header.Set("X-Forwarded-Proto", "https")
	response := httptest.NewRecorder()

	tokenAuth.Middleware()(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("request without token unexpectedly reached the registry handler")
	})).ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}

	expected := `Bearer realm="https://registry.example.com/zot/auth/token",service="zot-registry",scope=""`
	if challenge := response.Header().Get("WWW-Authenticate"); challenge != expected {
		t.Fatalf("unexpected challenge: %q", challenge)
	}
}

func TestSelectDistributionAuthMiddleware(t *testing.T) {
	t.Parallel()

	middleware := selectDistributionAuthMiddleware(
		markerMiddleware("ui"),
		markerMiddleware("registry"),
	)
	handler := middleware(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNoContent)
	}))

	tests := []struct {
		name           string
		path           string
		withUIHeader   bool
		expectedMarker string
	}{
		{name: "docker v2 request", path: "/v2/", expectedMarker: "registry"},
		{name: "docker manifest request", path: "/v2/repo/manifests/latest", expectedMarker: "registry"},
		{name: "ui v2 login request", path: "/v2/", withUIHeader: true, expectedMarker: "ui"},
		{name: "zot extension request", path: "/v2/_zot/ext/search", expectedMarker: "ui"},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "http://registry.test"+testCase.path, nil)
			if testCase.withUIHeader {
				request.Header.Set(constants.SessionClientHeaderName, constants.SessionClientHeaderValue)
			}
			response := httptest.NewRecorder()

			handler.ServeHTTP(response, request)

			if marker := response.Header().Get("X-Test-Auth-Middleware"); marker != testCase.expectedMarker {
				t.Fatalf("expected %q middleware, got %q", testCase.expectedMarker, marker)
			}
		})
	}
}

func markerMiddleware(marker string) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
			response.Header().Set("X-Test-Auth-Middleware", marker)
			next.ServeHTTP(response, request)
		})
	}
}

func requestRegistryToken(t *testing.T, tokenAuth *registryTokenAuth, username, password, scope string) string {
	t.Helper()

	request := httptest.NewRequest(http.MethodGet,
		"http://registry.test/zot/auth/token?scope="+scope, nil)
	if username != "" {
		request.SetBasicAuth(username, password)
	}

	response := httptest.NewRecorder()
	tokenAuth.TokenHandler()(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected token status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}

	var tokenResponse registryTokenResponse
	if err := json.Unmarshal(response.Body.Bytes(), &tokenResponse); err != nil {
		t.Fatal(err)
	}
	if tokenResponse.Token == "" {
		t.Fatal("token response is empty")
	}

	return tokenResponse.Token
}

func requestRegistryTokenOAuth(t *testing.T, tokenAuth *registryTokenAuth, username, password, scope string) string {
	t.Helper()

	form := url.Values{
		"grant_type": {"password"},
		"service":    {registryTokenService},
		"scope":      {scope},
		"client_id":  {"buildkit"},
		"username":   {username},
		"password":   {password},
	}
	request := httptest.NewRequest(http.MethodPost, "http://registry.test/zot/auth/token",
		strings.NewReader(form.Encode()))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response := httptest.NewRecorder()

	tokenAuth.TokenHandler()(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("expected token status %d, got %d: %s", http.StatusOK, response.Code, response.Body.String())
	}

	var tokenResponse registryTokenResponse
	if err := json.Unmarshal(response.Body.Bytes(), &tokenResponse); err != nil {
		t.Fatal(err)
	}
	if tokenResponse.Token == "" {
		t.Fatal("token response is empty")
	}

	return tokenResponse.Token
}
