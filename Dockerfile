# syntax=docker/dockerfile:1.7
# Publish with: docker buildx build --platform linux/amd64,linux/arm64 \
#   --provenance=false -t ghcr.io/xybingbing/registry:v1.0 --push .

ARG NODE_IMAGE=node:22-alpine
ARG GO_IMAGE=golang:1.26.3-bookworm
ARG RUNTIME_IMAGE=gcr.io/distroless/base-nossl-debian13:latest

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS ui-builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /src/frontend

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm run build


FROM --platform=$BUILDPLATFORM ${GO_IMAGE} AS zot-builder

ARG TARGETOS=linux
ARG TARGETARCH
ARG VERSION=dev
ARG COMMIT=unknown

WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . ./
RUN rm -rf pkg/extensions/build && mkdir -p pkg/extensions/build
COPY --from=ui-builder /src/frontend/build/ ./pkg/extensions/build/

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GO_VERSION="$(go version | awk '{print $3}')" && \
    CGO_ENABLED=0 GOEXPERIMENT=jsonv2 GOOS="$TARGETOS" GOARCH="$TARGETARCH" \
    go build \
      -p 1 \
      -buildmode=pie \
      -tags "events,imagetrust,lint,metrics,mgmt,profile,scrub,search,sync,ui,userprefs" \
      -trimpath \
      -ldflags "-s -w \
        -X zotregistry.dev/zot/v2/pkg/buildinfo.ReleaseTag=$VERSION \
        -X zotregistry.dev/zot/v2/pkg/buildinfo.Commit=$COMMIT \
        -X zotregistry.dev/zot/v2/pkg/buildinfo.BinaryType=extended \
        -X zotregistry.dev/zot/v2/pkg/buildinfo.GoVersion=$GO_VERSION" \
      -o /out/zot ./cmd/zot && \
    install -m 0600 /dev/null /out/htpasswd


FROM ${RUNTIME_IMAGE} AS final

ARG VERSION=dev
ARG COMMIT=unknown

LABEL org.opencontainers.image.title="zot" \
      org.opencontainers.image.description="OCI容器镜像注册表" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT" \
      org.opencontainers.image.source="https://github.com/xybingbing/registry"

COPY --from=zot-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=zot-builder /out/zot /usr/bin/zot
COPY --from=zot-builder --chmod=0600 /out/htpasswd /etc/zot/htpasswd
COPY config.json /etc/zot/config.json

VOLUME ["/var/lib/registry"]
EXPOSE 5000

ENTRYPOINT ["/usr/bin/zot"]
CMD ["serve", "/etc/zot/config.json"]
