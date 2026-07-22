package api

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"

	"zotregistry.dev/zot/v2/pkg/api/constants"
	apiErr "zotregistry.dev/zot/v2/pkg/api/errors"
	zcommon "zotregistry.dev/zot/v2/pkg/common"
	reqCtx "zotregistry.dev/zot/v2/pkg/requestcontext"
)

const (
	registryTokenIssuer   = "zot"
	registryTokenService  = "zot-registry"
	registryTokenLifetime = 5 * time.Minute
)

type registryTokenAuth struct {
	controller *Controller
	authorizer *BearerAuthorizer
	privateKey ed25519.PrivateKey
}

type registryTokenResponse struct {
	Token       string `json:"token"`
	AccessToken string `json:"access_token"` //nolint:tagliatelle
	ExpiresIn   int64  `json:"expires_in"`   //nolint:tagliatelle
	IssuedAt    string `json:"issued_at"`    //nolint:tagliatelle
}

func newRegistryTokenAuth(controller *Controller) (*registryTokenAuth, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate registry token signing key: %w", err)
	}

	return &registryTokenAuth{
		controller: controller,
		privateKey: privateKey,
		authorizer: NewBearerAuthorizer("", registryTokenService, func(_ context.Context, _ *jwt.Token) (any, error) {
			return publicKey, nil
		}),
	}, nil
}

func (auth *registryTokenAuth) Middleware() mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
			if request.Method == http.MethodOptions {
				next.ServeHTTP(response, request)

				return
			}

			requestedAccess := distributionResourceAction(request)
			err := auth.authorizer.Authorize(request.Context(), request.Header.Get("Authorization"), requestedAccess)
			if err != nil {
				challenge := AuthChallengeError{
					err:            err,
					realm:          auth.tokenRealm(request),
					service:        registryTokenService,
					resourceAction: requestedAccess,
				}

				response.Header().Set("Content-Type", "application/json")
				response.Header().Set("WWW-Authenticate", challenge.Header())
				zcommon.WriteJSON(response, http.StatusUnauthorized, apiErr.NewError(apiErr.UNAUTHORIZED))

				return
			}

			accessController := NewAccessController(auth.controller.Config)
			ctx := accessController.getAuthnMiddlewareContext(BEARER, request)
			next.ServeHTTP(response, request.WithContext(ctx)) //nolint:contextcheck
		})
	}
}

func (auth *registryTokenAuth) TokenHandler() http.HandlerFunc {
	return func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Cache-Control", "no-store")
		response.Header().Set("Pragma", "no-cache")

		if hasMultipleAuthorizationHeaders(request) {
			auth.rejectTokenCredentials(response, request)

			return
		}

		if request.Method == http.MethodPost {
			request.Body = http.MaxBytesReader(response, request.Body, int64(constants.MaxTokenRequestBodySize))
		}

		if err := request.ParseForm(); err != nil {
			zcommon.WriteJSON(response, http.StatusBadRequest, apiErr.NewError(apiErr.UNSUPPORTED))

			return
		}

		username := ""
		if !isAuthorizationHeaderEmpty(request) {
			var password string
			var ok bool
			username, password, ok = request.BasicAuth()
			if !ok {
				auth.rejectTokenCredentials(response, request)

				return
			}

			authenticated, _ := auth.controller.HTPasswd.Authenticate(username, password)
			if !authenticated {
				auth.rejectTokenCredentials(response, request)

				return
			}
		} else if request.Method == http.MethodPost && hasRegistryTokenFormCredentials(request) {
			username = request.PostForm.Get("username")
			password := request.PostForm.Get("password")
			if username == "" || password == "" {
				auth.rejectTokenCredentials(response, request)

				return
			}

			authenticated, _ := auth.controller.HTPasswd.Authenticate(username, password)
			if !authenticated {
				auth.rejectTokenCredentials(response, request)

				return
			}
		}

		access := auth.authorizedAccess(request, username)
		now := time.Now()
		claims := ClaimsWithAccess{
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    registryTokenIssuer,
				Subject:   username,
				Audience:  jwt.ClaimStrings{registryTokenService},
				IssuedAt:  jwt.NewNumericDate(now),
				NotBefore: jwt.NewNumericDate(now.Add(-issuedAtOffset)),
				ExpiresAt: jwt.NewNumericDate(now.Add(registryTokenLifetime)),
			},
			Access: access,
		}

		token, err := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims).SignedString(auth.privateKey)
		if err != nil {
			auth.controller.Log.Error().Err(err).Msg("failed to sign registry token")
			response.WriteHeader(http.StatusInternalServerError)

			return
		}

		zcommon.WriteJSON(response, http.StatusOK, registryTokenResponse{
			Token:       token,
			AccessToken: token,
			ExpiresIn:   int64(registryTokenLifetime.Seconds()),
			IssuedAt:    now.UTC().Format(time.RFC3339),
		})
	}
}

func (auth *registryTokenAuth) authorizedAccess(request *http.Request, username string) []ResourceAccess {
	accessController := NewAccessController(auth.controller.Config)
	userAccessControl := reqCtx.NewUserAccessControl()
	if username != "" {
		userAccessControl.SetUsername(username)
		userAccessControl.AddGroups(accessController.getUserGroups(username))
	}

	granted := make([]ResourceAccess, 0)

	for _, rawScope := range request.Form["scope"] {
		for _, scope := range strings.Fields(rawScope) {
			parts := strings.SplitN(scope, ":", 3)
			if len(parts) != 3 || parts[0] != "repository" || parts[1] == "" {
				continue
			}

			actions := make([]string, 0, 3)
			for _, requestedAction := range strings.Split(parts[2], ",") {
				if auth.canGrant(accessController, request, userAccessControl, requestedAction, parts[1]) {
					actions = append(actions, requestedAction)
				}
			}

			granted = append(granted, ResourceAccess{
				Type:    parts[0],
				Name:    parts[1],
				Actions: actions,
			})
		}
	}

	return granted
}

func hasRegistryTokenFormCredentials(request *http.Request) bool {
	return request.PostForm.Get("grant_type") == "password" ||
		request.PostForm.Get("username") != "" || request.PostForm.Get("password") != ""
}

func (auth *registryTokenAuth) canGrant(accessController *AccessController, request *http.Request,
	userAccessControl *reqCtx.UserAccessControl, action, repository string,
) bool {
	can := func(method, permission string) bool {
		permissionRequest := request.Clone(request.Context())
		permissionRequest.Method = method
		allowed, _ := accessController.can(permissionRequest, userAccessControl, permission, repository, "")

		return allowed
	}

	switch action {
	case "pull":
		return can(http.MethodGet, constants.ReadPermission)
	case "push":
		return can(http.MethodPost, constants.CreatePermission) && can(http.MethodPut, constants.UpdatePermission)
	case "delete":
		return can(http.MethodDelete, constants.DeletePermission)
	default:
		return false
	}
}

func (auth *registryTokenAuth) rejectTokenCredentials(response http.ResponseWriter, request *http.Request) {
	authConfig := auth.controller.Config.CopyAuthConfig()
	zcommon.AuthzFail(response, request, "", auth.controller.Config.GetRealm(), authConfig.GetFailDelay())
}

func (auth *registryTokenAuth) tokenRealm(request *http.Request) string {
	baseURL := strings.TrimSuffix(auth.controller.Config.HTTP.ExternalURL, "/")
	if baseURL == "" {
		scheme := "http"
		if request.TLS != nil {
			scheme = "https"
		} else if forwardedProto := strings.TrimSpace(strings.Split(request.Header.Get("X-Forwarded-Proto"), ",")[0]); forwardedProto == "http" || forwardedProto == "https" {
			scheme = forwardedProto
		}

		baseURL = (&url.URL{Scheme: scheme, Host: request.Host}).String()
	}

	return baseURL + constants.TokenPath
}

func distributionResourceAction(request *http.Request) *ResourceAction {
	if strings.TrimSuffix(request.URL.Path, "/") == constants.RoutePrefix {
		return nil
	}

	action := "pull"
	switch request.Method {
	case http.MethodPost, http.MethodPatch, http.MethodPut:
		action = "push"
	case http.MethodDelete:
		action = "delete"
	}

	return &ResourceAction{
		Type:   "repository",
		Name:   mux.Vars(request)["name"],
		Action: action,
	}
}
