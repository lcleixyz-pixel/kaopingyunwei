# Cloud Deployment Guide

本文是当前项目部署到云服务器的唯一准入文档。旧的方案文档和 `SKILL.md` 中的 Docker 示例只作为历史设计参考，不作为部署命令依据。

## 适用环境

- 服务器已安装宝塔 Linux 面板。
- 服务器上已有其他静态网站，因此本系统不直接占用公网 `80/443`。
- 本系统通过 Docker Compose 运行，前端容器只绑定到本机端口，再由宝塔/Nginx 按域名反向代理。
- MVP 阶段数据库继续使用 SQLite，不在本轮云部署中迁移 PostgreSQL。

## 端口规划

建议为本系统准备独立域名或子域名，例如：

```text
exam.example.com
```

本系统 Docker 前端建议监听本机端口：

```text
127.0.0.1:8080
```

宝塔/Nginx 负责：

- 监听公网 `80/443`。
- 申请和续期 HTTPS 证书。
- 将 `exam.example.com` 反向代理到 `http://127.0.0.1:8080`。

这样不会影响服务器上已有的两个静态网站。

## 首次部署

进入应用目录：

```bash
cd /path/to/kaopingyunwei-main/app
```

复制环境变量：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改这些值：

```bash
EXAM_PORT=127.0.0.1:8080
JWT_SECRET=替换为至少32字符的随机密钥
ENCRYPTION_KEY=替换为至少32字符的随机密钥
CORS_ORIGIN=https://exam.example.com
```

生成随机密钥可用：

```bash
openssl rand -base64 48
```

注意：生产环境不能使用 `.env.example` 中的 `change-this-...` 占位值。后端启动时会拒绝默认密钥和占位密钥。

启动：

```bash
./scripts/start.sh
```

或手动执行：

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

检查容器：

```bash
docker ps
docker logs exam-backend --tail 80
docker logs exam-frontend --tail 80
curl http://127.0.0.1:8080/api/health
```

健康检查应返回：

```json
{"status":"ok","version":"1.0.0"}
```

## 宝塔反向代理

在宝塔中为 `exam.example.com` 新建站点，站点类型可以是普通静态站点，然后配置反向代理：

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
}
```

宝塔开启 HTTPS 后，浏览器访问：

```text
https://exam.example.com
```

如果宝塔提供“反向代理”图形界面，目标 URL 填：

```text
http://127.0.0.1:8080
```

## 数据持久化

当前 `docker/docker-compose.yml` 使用 Docker named volumes：

- `exam-data`：SQLite 数据库和数据目录。
- `exam-files`：上传文件目录。
- `exam-backups`：备份文件目录。

不要简单理解为宿主机项目目录下的 `app/data` 就是生产数据。云部署时应按 Docker volume 做备份。

查看 volume：

```bash
docker volume ls | grep exam
```

## 备份

应用内 AI 运维和脚本会把备份放在容器数据目录的备份区。云服务器还应做一份容器级备份。

手动导出 Docker volumes：

```bash
mkdir -p /root/kaoping-backups
BACKUP_NAME=kaoping-$(date +%Y%m%d-%H%M%S)

docker run --rm -v docker_exam-data:/data -v /root/kaoping-backups:/backup alpine \
  tar czf /backup/${BACKUP_NAME}-exam-data.tar.gz -C /data .

docker run --rm -v docker_exam-files:/data -v /root/kaoping-backups:/backup alpine \
  tar czf /backup/${BACKUP_NAME}-exam-files.tar.gz -C /data .

docker run --rm -v docker_exam-backups:/data -v /root/kaoping-backups:/backup alpine \
  tar czf /backup/${BACKUP_NAME}-exam-backups.tar.gz -C /data .
```

如果你的 Compose project name 不是 `docker`，volume 名称可能不是 `docker_exam-data`。以 `docker volume ls | grep exam` 的实际结果为准。

建议再把 `/root/kaoping-backups` 同步到云厂商对象存储或另一台机器。

## 恢复

先停止服务：

```bash
docker compose --env-file .env -f docker/docker-compose.yml down
```

恢复前务必确认目标 volume 名称：

```bash
docker volume ls | grep exam
```

恢复示例：

```bash
docker run --rm -v docker_exam-data:/data -v /root/kaoping-backups:/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/kaoping-YYYYMMDD-HHMMSS-exam-data.tar.gz -C /data"

docker run --rm -v docker_exam-files:/data -v /root/kaoping-backups:/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/kaoping-YYYYMMDD-HHMMSS-exam-files.tar.gz -C /data"

docker run --rm -v docker_exam-backups:/data -v /root/kaoping-backups:/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/kaoping-YYYYMMDD-HHMMSS-exam-backups.tar.gz -C /data"
```

重新启动：

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

## 上线后必须做

1. 用 `admin / admin123` 首次登录。
2. 立即修改默认管理员密码。
3. 确认 `hqadmin`、分支管理员和工作人员账号权限正常。
4. 打开仪表盘、报名资料、成绩、证书、档案、AI 运维、系统设置。
5. 执行一次手动备份。
6. 下载或导出一份备份到服务器外部位置。
7. 保留 `.env`，但不要把 `.env` 上传到公共仓库或发给无关人员。

## 上线验收命令

在服务器 `app/` 目录执行：

```bash
npm run check
npm run lint
npx prisma migrate status --schema src/backend/prisma/schema.prisma
docker compose --env-file .env -f docker/docker-compose.yml config
curl http://127.0.0.1:8080/api/health
```

通过浏览器访问公网域名：

```text
https://exam.example.com
```

检查：

- 页面不白屏。
- 登录成功。
- 未登录访问业务接口返回 401。
- 分支工作人员无系统设置入口。
- `teststaff` 或分支工作人员访问 `/api/settings` 返回 403。
- 未知 API 返回 JSON 404。

## 常见问题

### 启动后后端反复退出

优先看日志：

```bash
docker logs exam-backend --tail 120
```

如果提示 `JWT_SECRET` 或 `ENCRYPTION_KEY`，说明 `.env` 仍在使用默认值或占位值。

### 宝塔已有站点被影响

确认 `.env` 中不是：

```bash
EXAM_PORT=80
```

宝塔场景建议使用：

```bash
EXAM_PORT=127.0.0.1:8080
```

### API 404 或登录失败

确认宝塔反向代理目标是：

```text
http://127.0.0.1:8080
```

不要只代理静态文件目录。本项目的 `/api` 也由同一个前端 Nginx 容器转发到后端容器。
