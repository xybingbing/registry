# Registry

基于 [zot](https://github.com/project-zot/zot) 构建的 OCI/Docker 镜像仓库，内置经过定制的 Web 管理界面。后端与前端通过多阶段 Docker 构建合并为一个镜像，可直接运行在 `linux/amd64` 和 `linux/arm64` 环境。

镜像地址：

```text
ghcr.io/xybingbing/registry:v1.0
```

## 界面预览

### 首页

首页展示常用仓库、最近更新、镜像描述和支持的平台。

![Registry 首页](docs/images/home.jpg)

### 镜像探索

通过搜索和排序快速浏览仓库中的镜像。

![Registry 镜像探索](docs/images/explore.jpg)

### 仓库详情

查看标签、Digest、操作系统、架构和压缩大小。拉取命令会自动带上当前访问的仓库地址。

![Registry 仓库详情](docs/images/repository.jpg)

## 主要功能

- 兼容 OCI Distribution Specification 和 Docker Registry API。
- zot 后端与 React 前端打包在同一个镜像中，无需单独部署 UI。
- 支持仓库搜索、标签列表、Digest、平台和镜像大小展示。
- 自动生成包含当前仓库域名和端口的 `docker pull` 命令。
- 支持 Docker Hub、Quay、GHCR 等上游仓库的按需同步。
- 支持按 `linux/amd64`、`linux/arm64` 等平台过滤同步内容。
- 使用单个多阶段 Dockerfile 构建前端、Go 服务端和最小运行镜像。
- 官方镜像同时发布 `linux/amd64` 和 `linux/arm64` 架构。

## 快速启动

启动仓库：

```bash
docker run -d \
  --name registry \
  --restart unless-stopped \
  -p 5000:5000 \
  -v registry-data:/var/lib/registry \
  ghcr.io/xybingbing/registry:v1.0
```

浏览器访问 [http://localhost:5000](http://localhost:5000)。

检查服务状态：

```bash
curl http://localhost:5000/v2/
```

## 推送和拉取镜像

向本地仓库推送 Alpine：

```bash
docker pull alpine:3.20
docker tag alpine:3.20 localhost:5000/library/alpine:3.20
docker push localhost:5000/library/alpine:3.20
```

从仓库拉取镜像：

```bash
docker pull localhost:5000/library/alpine:3.20
```

生产环境应为仓库配置 TLS 和身份认证。使用非 `localhost` 的 HTTP 地址时，还需要在 Docker daemon 中配置 insecure registry。

## 配置

镜像默认读取 `/etc/zot/config.json`。仓库数据保存在 `/var/lib/registry`。

使用项目中的配置文件启动：

```bash
docker run -d \
  --name registry \
  --restart unless-stopped \
  -p 5000:5000 \
  -v registry-data:/var/lib/registry \
  -v "$(pwd)/config.json:/etc/zot/config.json:ro" \
  ghcr.io/xybingbing/registry:v1.0
```

当前示例配置启用了：

- 搜索扩展和 Web UI。
- Docker Registry 兼容模式。
- Docker Hub、Quay、GHCR 等上游的按需同步。
- `amd64` 和 `arm64` 平台过滤。

部署前请根据实际环境检查 [config.json](config.json) 中的同步源、超时、日志级别和存储目录。

## 多架构构建

项目根目录只保留一个 [Dockerfile](Dockerfile)，包含三个构建阶段：

1. 使用 Node.js 和 pnpm 构建 `frontend`。
2. 将前端产物嵌入 zot，并针对目标架构编译 Go 二进制。
3. 将二进制和配置复制到 distroless 运行镜像。

创建并启用 buildx builder：

```bash
docker buildx create --name registry-builder --use
docker buildx inspect --bootstrap
```

构建并推送多架构镜像：

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg VERSION=v1.0 \
  --build-arg COMMIT="$(git rev-parse --short HEAD)" \
  --provenance=false \
  -t ghcr.io/xybingbing/registry:v1.0 \
  --push .
```

`--provenance=false` 用于避免部分镜像仓库 UI 将 BuildKit provenance 显示为额外的 `unknown/unknown` 平台。

验证远端多架构清单：

```bash
docker buildx imagetools inspect \
  ghcr.io/xybingbing/registry:v1.0
```

## GitHub Actions 自动发布

[publish-image.yml](.github/workflows/publish-image.yml) 会使用 GitHub 提供的 `GITHUB_TOKEN` 登录 GHCR，并通过 Buildx 构建和推送 `linux/amd64`、`linux/arm64` 镜像，无需额外配置仓库密码。

- 推送到 `main`：发布 `v1.0`、`latest` 和 `sha-<commit>` 标签。
- 推送 `v*` Git 标签：发布对应版本标签和提交 SHA 标签。
- 在 Actions 页面手动运行：发布当前分支对应的镜像标签。

## 项目结构

```text
.
├── Dockerfile          # 前端、后端和运行镜像的多阶段构建
├── config.json         # 默认 zot 配置
├── frontend/           # React/Vite Web UI
├── pkg/                # zot 服务端核心代码与扩展
├── cmd/                # zot 命令入口
├── docs/images/        # README 界面截图
├── go.mod
└── Makefile
```

## 本地开发

前端开发：

```bash
cd frontend
corepack enable
pnpm install --frozen-lockfile
pnpm start
```

前端生产构建：

```bash
cd frontend
pnpm run build
```

完整镜像构建会自动完成前端构建和嵌入，无需手工复制 `frontend/build`。

## 数据持久化

请始终将 `/var/lib/registry` 挂载到 Docker volume 或持久化磁盘：

```bash
docker volume inspect registry-data
```

升级或迁移前应备份该数据卷以及实际使用的 `config.json`。

## License

本项目基于 zot 开发，遵循仓库中的 [LICENSE](LICENSE)。
