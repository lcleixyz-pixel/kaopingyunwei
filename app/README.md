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
| AI运维 | 内置运维面板，自然语言交互 |

## 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 克隆项目
cd exam-system

# 2. 复制环境变量配置
cp .env.example .env

# 3. 一键启动
./scripts/start.sh

# 4. 打开浏览器访问 http://localhost
```

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

## 默认登录账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | admin | admin123 |
| 总部管理员 | hqadmin | hqadmin123 |
| 分部管理员 | bjadmin | bjadmin123 |

## 9大考评节点

```
考前节点（参考执行）          考中节点             考后节点（强制执行）
制定计划 (D-10) ──────→ 考试 (D-Day) ──────→ 成绩检录 (D+3)
考试报名 (D-7)                              成绩公示 (D+5, ≥5天)
考场编排 (D-5)                              证书管理 (D+10)
考务安排 (D-5)                              完成认定 (D+10)
```

## AI运维助手

打开系统设置 → AI运维中心，用自然语言管理系统：

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
├── 📄 docker-compose.yml    # Docker部署配置
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
│   ├── 📁 frontend/         # React前端
│   │   └── 📁 src/
│   │       ├── 📁 pages/    # 页面组件
│   │       ├── 📁 components/ # UI组件
│   │       ├── 📁 stores/   # Zustand状态
│   │       └── 📁 hooks/    # 自定义Hooks
│   │
│   └── 📁 shared/           # 前后端共享类型
│
├── 📁 docker/               # Docker配置
├── 📁 scripts/              # 运维脚本
│   ├── 📄 start.sh          # 一键启动
│   ├── 📄 stop.sh           # 一键停止
│   └── 📄 backup.sh         # 一键备份
│
└── 📁 data/                 # 数据目录（Docker卷）
    ├── 📄 exam.db           # SQLite数据库
    ├── 📁 files/            # 上传文件
    └── 📁 backups/          # 备份文件
```

## 使用 Cursor/Codex 开发

本系统为AI开发优化，配备了 `.cursorrules` 文件和 `docs/AI_CONTEXT.md`：

```
1. 打开项目 in Cursor
2. 粘贴 docs/AI_CONTEXT.md 作为上下文
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

- 传输：全站HTTPS（TLS 1.3）
- 存储：敏感字段AES-256加密
- 访问：基于RBAC的细粒度权限
- 审计：全操作留痕，不可篡改
- 备份：每日自动备份，30天保留

## 迁移说明

**三个文件夹走天下**：

```
data/          ← SQLite数据库（exam.db）
files/         ← 上传的证书、档案等
backups/       ← 自动备份文件
```

迁移步骤：
1. 复制三个文件夹到新机器
2. 执行 `docker-compose up -d`
3. 完成！

## 许可证

MIT License — 可私有化部署，可提供给其他分支机构使用。

---

> 遇到问题？查看 `docs/SKILL.md` 获取完整技术文档。
