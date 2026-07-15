//go:build search && ui

package extensions

import (
	"compress/gzip"
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gorilla/mux"

	"zotregistry.dev/zot/v2/pkg/api/config"
	zcommon "zotregistry.dev/zot/v2/pkg/common"
	"zotregistry.dev/zot/v2/pkg/log"
)

// content is our static web server content.
//
//go:embed build/*
var content embed.FS

type uiHandler struct {
	log log.Logger
}

type gzipResponseWriter struct {
	http.ResponseWriter
	writer *gzip.Writer
}

func (grw gzipResponseWriter) Write(data []byte) (int, error) {
	return grw.writer.Write(data)
}

func (uih uiHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	buf, _ := content.ReadFile("build/index.html")

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	_, err := w.Write(buf)
	if err != nil {
		uih.log.Error().Err(err).Msg("failed to serve index.html")
	}
}

func addUISecurityHeaders(h http.Handler) http.HandlerFunc { //nolint:varnamelen
	return func(w http.ResponseWriter, r *http.Request) {
		permissionsPolicy := "microphone=(), geolocation=(), battery=(), camera=(), autoplay=(), gyroscope=(), payment=()"
		w.Header().Set("Permissions-Policy", permissionsPolicy)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")

		cspDirectives := []string{
			"default-src 'none'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline'",
			"font-src 'self'",
			"connect-src 'self'",
			"img-src 'self' data:",
			"manifest-src 'self'",
			"base-uri 'self'",
		}
		w.Header().Set("Content-Security-Policy", strings.Join(cspDirectives, "; "))

		h.ServeHTTP(w, r)
	}
}

func addUIAssetHeaders(h http.Handler) http.HandlerFunc { //nolint:varnamelen
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}

		h.ServeHTTP(w, r)
	}
}

func addUIGzip(h http.Handler) http.HandlerFunc { //nolint:varnamelen
	return func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") || !shouldGzipUIPath(r.URL.Path) {
			h.ServeHTTP(w, r)

			return
		}

		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Add("Vary", "Accept-Encoding")
		w.Header().Del("Content-Length")

		gzw := gzip.NewWriter(w)
		defer gzw.Close()

		h.ServeHTTP(gzipResponseWriter{ResponseWriter: w, writer: gzw}, r)
	}
}

func shouldGzipUIPath(requestPath string) bool {
	switch path.Ext(requestPath) {
	case ".js", ".css", ".html", ".json", ".svg":
		return true
	default:
		return requestPath == "/" ||
			strings.HasPrefix(requestPath, "/login") ||
			strings.HasPrefix(requestPath, "/home") ||
			strings.HasPrefix(requestPath, "/explore") ||
			strings.HasPrefix(requestPath, "/image") ||
			strings.HasPrefix(requestPath, "/user")
	}
}

func uiHeaders(h http.Handler) http.Handler {
	return addUISecurityHeaders(addUIAssetHeaders(addUIGzip(h)))
}

func SetupUIRoutes(conf *config.Config, router *mux.Router,
	log log.Logger,
) {
	extensionsConfig := conf.CopyExtensionsConfig()
	if !extensionsConfig.IsUIEnabled() {
		log.Info().Msg("skip enabling the ui route as the config prerequisites are not met")

		return
	}

	log.Info().Msg("setting up ui routes")

	fsub, _ := fs.Sub(content, "build")
	uih := uiHandler{log: log}

	// See https://go-review.googlesource.com/c/go/+/482635/2/src/net/http/fs.go
	// See https://github.com/golang/go/issues/59469
	// In go 1.20.4 they decided to allow any method in the FileServer handler.
	// In order to be consistent with the status codes returned when the UI is disabled
	// we need to be explicit about the methods we allow on UI routes.
	// If we don't add this, all unmatched http methods on any urls would match the UI routes.
	allowedMethods := zcommon.AllowedMethods(http.MethodGet)

	router.PathPrefix("/login").Methods(allowedMethods...).
		Handler(uiHeaders(uih))
	router.PathPrefix("/home").Methods(allowedMethods...).
		Handler(uiHeaders(uih))
	router.PathPrefix("/explore").Methods(allowedMethods...).
		Handler(uiHeaders(uih))
	router.PathPrefix("/image").Methods(allowedMethods...).
		Handler(uiHeaders(uih))
	router.PathPrefix("/user").Methods(allowedMethods...).
		Handler(uiHeaders(uih))
	router.PathPrefix("/").Methods(allowedMethods...).
		Handler(uiHeaders(http.FileServer(http.FS(fsub))))

	log.Info().Msg("finished setting up ui routes")
}
