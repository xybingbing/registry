# Docker Compose 测试

在项目根目录执行：

```bash
docker compose -f example/compose.yaml up -d --build
```

默认只监听 `127.0.0.1:5000`，Web UI 地址为 [http://localhost:5000](http://localhost:5000)。测试账号如下：

```text
用户名：registry-admin
密码：registry-test-password
```

默认账号只用于本地测试。可以在启动前通过环境变量修改账号、密码和端口：

```bash
REGISTRY_USERNAME=test-admin \
REGISTRY_PASSWORD='replace-with-a-test-password' \
REGISTRY_PORT=5100 \
docker compose -f example/compose.yaml up -d --build
```

## 验证匿名 pull

未登录时直接拉取本地不存在的镜像，registry 会匿名执行按需同步：

```bash
docker pull localhost:5000/alpine:3.20
```

## 验证 push 权限

先在未登录状态尝试推送：

```bash
docker logout localhost:5000 2>/dev/null || true
docker tag localhost:5000/alpine:3.20 localhost:5000/test/alpine:3.20
docker push localhost:5000/test/alpine:3.20
```

此时应返回 `unauthorized: authentication required`。

登录后重新推送：

```bash
docker login localhost:5000 -u registry-admin
docker push localhost:5000/test/alpine:3.20
```

## 查看和清理

```bash
docker compose -f example/compose.yaml logs -f registry
docker compose -f example/compose.yaml down -v
```

`down -v` 会同时删除示例创建的仓库数据和测试凭据。
