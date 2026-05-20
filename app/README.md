# 考评分支机构管理系统

> 职业技能等级认定考务全流程管理系统  
> 覆盖从计划制定到完成认定的9大节点，总部集中部署，AI运维助手

---

## 系统概述

本系统专为**职业技能等级认定机构**设计，实现考务管理的全流程数字化：

- 9大考评节点自动追踪与提醒
- 多分支机构独立运营，总部集中监管
- AI运维助手，非专业运维人员也能轻松管理
- 私有化部署，数据完全自主可控
- 一键迁移，随时随地搬家

## 技术架构

| 层级 | 技术选型 |
|------|---------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand |
| 后端 | Express + TypeScript + Prisma |
| 数据库 | SQLite（单文件，零运维） |
| 部署 | Docker Compose 一键启动 |
| AI运维 | 内置规则化运维面板 |

## 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 进入应用目录
cd app

# 2. 复制环境变量配置
cp .env.example .env

# 3. 修改 .env 中的 JWT_SECRET、ENCRYPTION_KEY
# 云服务器 + 宝塔反向代理场景建议设置：
# EXAM_PORT=127.0.0.1:8080

# 4. 一键启动
./scripts/start.sh

# 5. 本机检查
curl http://127.0.0.1:8080/api/health
```

云服务器、宝塔 Linux 面板、域名 HTTPS、备份和恢复请以 [云服务器部署指南](../docs/DEPLOYMENT_CLOUD.md) 为准。

### 方式二：手动启动（开发模式）

```bash
# 后端
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate dev --schema src/backend/prisma/schema.prisma
npx tsx src/backend/src/scripts/seed.ts
npm run backend:dev

# 前端（新终端）
npm run dev
```

## 初始化账号

seed 会创建系统管理员、总部管理员和分支账号；密码必须通过 `SEED_USER_PASSWORDS_JSON` 注入，或在非生产环境由 seed 生成一次性密码并立即保存到受控密码管理位置。仓库文档不再记录固定演示密码。

## 文档入口

如果你不是开发人员，建议先看这三份：

- [新手快速上手](../docs/USER_QUICK_START.md)：给第一次登录系统的人，照着做即可完成日常操作。
- [使用者完整手册](../docs/USER_MANUAL.md)：按页面解释每个菜单能做什么、谁能操作、遇到提示怎么办。
- [管理员傻瓜式运维手册](../docs/ADMIN_SIMPLE_RUNBOOK.md)：给负责服务器、账号、备份和更新的人，包含常见问题处理步骤。

如果你是开发或部署人员，再看这些：

- [云服务器部署指南](../docs/DEPLOYMENT_CLOUD.md)：服务器、Docker、宝塔/Nginx、HTTPS、备份和恢复。
- [验收清单](../docs/ACCEPTANCE_CHECKLIST.md)：每次上线或改功能前后要检查什么。
- [AI 交接文档](../docs/AI_HANDOFF.md)：当前项目进度、最近验证结果和下一步注意事项。

## 9大考评节点

```
考前节点（参考执行）          考中节点             考后节点（强制执行）
制定计划 (D-10) ──────→ 考试 (D-Day) ──────→ 成绩检录 (D+3)
考试报名 (D-7)                              成绩公示 (D+5, ≥5天)
考场编排 (D-5)                              证书管理 (D+10)
考务安排 (D-5)                              完成认定 (D+10)
```

## AI运维助手

打开 AI 运维中心，使用规则化运维面板管理系统：

| 你说 | AI做 |
|------|------|
| "帮我备份数据" | 立即全量备份 |
| "系统正常吗？" | 检查健康状态 |
| "我要迁移到新服务器" | 一键打包导出 |
| "最近有什么异常？" | 自动分析日志 |

## 项目结构

```
exam-system/
├── 📄 .env                  # 环境变量配置
├── 📄 README.md             # 本文件
│
├── 📁 src/
│   ├── 📁 backend/          # Express后端
│   │   ├── 📁 prisma/       # 数据库模型
│   │   └── 📁 src/
│   │       ├── 📁 routes/   # API路由
│   │       ├── 📁 middleware/ # 认证/租户/审计
│   │       ├── 📁 jobs/     # 定时任务
│   │       └── 📁 utils/    # 工具函数
│   │
│   ├── 📁 pages/            # 页面组件
│   ├── 📁 components/       # UI组件
│   ├── 📁 stores/           # Zustand状态
│   └── 📁 hooks/            # 自定义Hooks
│
├── 📁 docker/               # Docker配置
├── 📁 scripts/              # 运维脚本
│   ├── 📄 start.sh          # 一键启动
│   ├── 📄 stop.sh           # 一键停止
│   └── 📄 backup.sh         # 一键备份
│
└── 📁 data/                 # 本地开发数据目录
    ├── 📄 exam.db           # SQLite数据库
    ├── 📁 files/            # 上传文件
    └── 📁 backups/          # 备份文件
```

## 使用 Cursor/Codex 开发

本系统为 AI 开发优化，项目关键上下文位于根目录 `docs/`：

```
1. 打开项目 in Cursor
2. 先阅读 `docs/AI_HANDOFF.md`、`docs/PROJECT_CONTEXT.md`、`docs/BUSINESS_RULES.md`
3. 描述需求 → AI生成代码 → 审查 → 测试 → 提交
```

### Prompt 示例

```
我要新增一个功能：考评计划支持批量导入考生。
请生成：
1. 后端API（接收CSV，批量创建考生）
2. 前端组件（上传CSV + 预览 + 确认导入）
3. 测试用例
```

## 常用命令

```bash
# 启动系统
./scripts/start.sh

# 停止系统
./scripts/stop.sh

# 备份数据
./scripts/backup.sh

# 查看日志
docker logs exam-backend
docker logs exam-frontend

# 进入数据库
npx prisma studio --schema src/backend/prisma/schema.prisma

# 重置数据库
npx prisma migrate reset --schema src/backend/prisma/schema.prisma
```

## 数据安全

- 传输：生产环境必须通过宝塔/Nginx/云负载均衡配置 HTTPS
- 存储：敏感字段AES-256加密
- 访问：基于RBAC的细粒度权限
- 审计：全操作留痕，不可篡改
- 备份：每日自动备份，30天保留

## 迁移说明

当前 Docker 部署使用 named volumes 持久化生产数据：

```
exam-data       ← SQLite 数据库和数据目录
exam-files      ← 上传文件
exam-backups    ← 备份文件
```

迁移、备份和恢复步骤请以 [云服务器部署指南](../docs/DEPLOYMENT_CLOUD.md) 为准。

## 许可证

MIT License — 可私有化部署，可提供给其他分支机构使用。

---

> 遇到部署问题？优先查看 [云服务器部署指南](../docs/DEPLOYMENT_CLOUD.md)。
