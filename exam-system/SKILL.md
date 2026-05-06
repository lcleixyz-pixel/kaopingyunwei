# 考评分支机构管理系统 — AI初始化技能文档

> 文档角色：项目宪法 · AI开发上下文 · 运维手册  
> 适用读者：AI助手(Cursor/Codex/ChatGPT)、开发者、运维人员  
> 版本：v1.0  
> 日期：2026-05-04

---

## 一、项目定位

### 1.1 一句话定义

**职业技能等级认定考务全流程管理系统** — 覆盖从计划制定到完成认定9大节点，支持多分支机构，总部集中部署，内置AI运维助手。

### 1.2 核心架构决策（已锁定）

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 前端框架 | React 19 + TypeScript + Vite | 组件化、生态丰富、AI生成友好 |
| UI组件库 | Tailwind CSS + shadcn/ui | 原子化CSS、无运行时、主题可控 |
| 状态管理 | Zustand | 轻量、TypeScript友好、无样板代码 |
| 后端框架 | Express + TypeScript | 轻量稳定、中间件生态成熟 |
| ORM | Prisma | 类型安全、迁移自动化、AI生成友好 |
| 数据库 | SQLite (起步) → PostgreSQL (扩展) | 单文件零运维、平滑迁移 |
| 部署方式 | Docker Compose | 本地→云端无缝迁移 |
| 文件存储 | 本地文件系统 (数据卷挂载) | 简单可控、备份即复制 |
| AI运维 | 内置运维面板 + 自然语言交互 | 非专业运维友好 |
| 目标规模 | 年考评1200人、5分支、8年数据 | 设计容量满足未来5年增长 |

### 1.3 部署路径

```
阶段1 (现在)          阶段2 (成熟后)
┌──────────┐         ┌──────────────┐
│ 本地电脑  │ ──────► │  云服务器     │
│ Docker   │  迁移   │  Docker      │
│ SQLite   │         │  PostgreSQL  │
└──────────┘         └──────────────┘
     │                        │
     └──────────┬─────────────┘
                ▼
         ┌──────────────┐
         │ 分支机构浏览器 │
         │    访问       │
         └──────────────┘
```

> **迁移只需3步**：① 导出数据包 ② 新机器安装Docker ③ 导入数据包并启动

---

## 二、目录结构

```
exam-system/
├── 📁 docs/                          # 项目文档（知识库）
│   ├── SKILL.md                      # 本文档 — 项目宪法
│   ├── API.md                        # API接口文档（自动生成）
│   ├── DATABASE.md                   # 数据库说明
│   ├── ARCHITECTURE.md               # 架构决策记录
│   ├── CHANGELOG.md                  # 版本变更日志
│   ├── AI_CONTEXT.md                 # AI开发上下文（给AI的prompt）
│   └── prompts/                      # AI协作Prompt模板
│       ├── add-feature.md
│       ├── fix-bug.md
│       ├── add-exam-node.md
│       └── generate-report.md
│
├── 📁 src/
│   ├── 📁 shared/                    # 🔗 前后端共享代码
│   │   └── 📁 types/
│   │       └── index.ts              # 全局类型定义
│   │
│   ├── 📁 frontend/                  # 🎨 前端 (React + Vite)
│   │   ├── 📄 index.html
│   │   ├── 📄 vite.config.ts
│   │   ├── 📄 tailwind.config.js
│   │   ├── 📄 tsconfig.json
│   │   ├── 📁 src/
│   │   │   ├── 📄 main.tsx           # 应用入口
│   │   │   ├── 📄 App.tsx            # 路由根组件
│   │   │   ├── 📁 pages/             # 页面级组件
│   │   │   │   ├── 📄 Dashboard.tsx  # 仪表盘首页
│   │   │   │   ├── 📄 ExamPlans.tsx  # 考评计划管理
│   │   │   │   ├── 📄 ExamNodes.tsx  # 考评节点追踪
│   │   │   │   ├── 📄 Candidates.tsx # 考生管理
│   │   │   │   ├── 📄 Scores.tsx     # 成绩管理
│   │   │   │   ├── 📄 Certificates.tsx # 证书管理
│   │   │   │   ├── 📄 Archives.tsx   # 档案管理
│   │   │   │   ├── 📄 Settings.tsx   # 系统设置
│   │   │   │   └── 📄 AiOps.tsx      # AI运维助手面板
│   │   │   ├── 📁 components/        # 可复用组件
│   │   │   │   ├── 📁 ui/            # shadcn/ui 基础组件
│   │   │   │   ├── 📁 layout/        # 布局组件
│   │   │   │   │   ├── 📄 Sidebar.tsx
│   │   │   │   │   ├── 📄 Header.tsx
│   │   │   │   │   └── 📄 Layout.tsx
│   │   │   │   ├── 📁 exam/          # 考评业务组件
│   │   │   │   │   ├── 📄 NodeCard.tsx      # 节点卡片
│   │   │   │   │   ├── 📄 NodeTimeline.tsx  # 节点时间线
│   │   │   │   │   ├── 📄 ReminderBadge.tsx # 提醒标记
│   │   │   │   │   └── 📄 DeadlineTimer.tsx # 倒计时
│   │   │   │   ├── 📁 dashboard/     # 仪表盘组件
│   │   │   │   │   ├── 📄 StatsCard.tsx
│   │   │   │   │   ├── 📄 ProgressChart.tsx
│   │   │   │   │   └── 📄 AlertList.tsx
│   │   │   │   └── 📁 ai-ops/        # AI运维组件
│   │   │   │       ├── 📄 AiChat.tsx       # AI对话界面
│   │   │   │       ├── 📄 QuickActions.tsx # 快捷操作
│   │   │   │       └── 📄 HealthStatus.tsx # 健康状态
│   │   │   ├── 📁 hooks/             # 自定义Hooks
│   │   │   │   ├── 📄 useAuth.ts
│   │   │   │   ├── 📄 useExamNodes.ts
│   │   │   │   ├── 📄 useReminders.ts
│   │   │   │   └── 📄 useApi.ts      # 统一API请求
│   │   │   ├── 📁 stores/            # Zustand状态管理
│   │   │   │   ├── 📄 authStore.ts
│   │   │   │   ├── 📄 examStore.ts
│   │   │   │   └── 📄 uiStore.ts
│   │   │   ├── 📁 lib/               # 工具函数
│   │   │   │   ├── 📄 utils.ts
│   │   │   │   ├── 📄 dateUtils.ts   # 工作日计算
│   │   │   │   └── 📄 constants.ts   # 常量定义
│   │   │   └── 📁 styles/
│   │   │       └── 📄 globals.css
│   │   └── 📄 package.json
│   │
│   └── 📁 backend/                   # ⚙️ 后端 (Express + TS)
│       ├── 📄 package.json
│       ├── 📄 tsconfig.json
│       ├── 📄 prisma/schema.prisma   # 数据库模型
│       ├── 📁 src/
│       │   ├── 📄 index.ts           # 服务入口
│       │   ├── 📄 app.ts             # Express应用配置
│       │   ├── 📁 config/            # 配置管理
│       │   │   └── 📄 index.ts
│       │   ├── 📁 routes/            # API路由
│       │   │   ├── 📄 index.ts       # 路由聚合
│       │   │   ├── 📄 auth.ts        # 认证路由
│       │   │   ├── 📄 exam-plans.ts  # 考评计划
│       │   │   ├── 📄 exam-nodes.ts  # 考评节点
│       │   │   ├── 📄 candidates.ts  # 考生管理
│       │   │   ├── 📄 scores.ts      # 成绩管理
│       │   │   ├── 📄 certificates.ts # 证书管理
│       │   │   ├── 📄 archives.ts    # 档案管理
│       │   │   ├── 📄 reminders.ts   # 提醒服务
│       │   │   ├── 📄 export.ts      # 导出/迁移
│       │   │   └── 📄 ai-ops.ts      # AI运维接口
│       │   ├── 📁 services/          # 业务服务层
│       │   │   ├── 📄 examPlanService.ts
│       │   │   ├── 📄 examNodeService.ts
│       │   │   ├── 📄 reminderService.ts
│       │   │   ├── 📄 exportService.ts
│       │   │   └── 📄 aiOpsService.ts
│       │   ├── 📁 middleware/        # 中间件
│       │   │   ├── 📄 auth.ts        # 认证中间件
│       │   │   ├── 📄 errorHandler.ts # 错误处理
│       │   │   ├── 📄 auditLog.ts    # 审计日志
│       │   │   └── 📄 tenant.ts      # 多租户隔离
│       │   ├── 📁 jobs/              # 定时任务
│       │   │   ├── 📄 scheduler.ts   # 任务调度器
│       │   │   ├── 📄 reminders.ts   # 提醒任务
│       │   │   └── 📄 backups.ts     # 自动备份
│       │   ├── 📁 utils/             # 工具函数
│       │   │   ├── 📄 dateUtils.ts   # 工作日计算
│       │   │   ├── 📄 crypto.ts      # 加密工具
│       │   │   ├── 📄 logger.ts      # 日志工具
│       │   │   └── 📄 validators.ts  # 校验工具
│       │   └── 📁 types/             # 后端类型
│       │       └── 📄 index.ts
│       └── 📁 scripts/               # 数据库脚本
│           └── 📄 seed.ts            # 初始数据
│
├── 📁 docker/                        # 🐳 Docker配置
│   ├── 📄 Dockerfile.frontend
│   ├── 📄 Dockerfile.backend
│   └── 📄 docker-compose.yml
│
├── 📁 scripts/                       # 🔧 运维脚本
│   ├── 📄 start.sh                   # 一键启动
│   ├── 📄 backup.sh                  # 一键备份
│   ├── 📄 restore.sh                 # 一键恢复
│   ├── 📄 migrate-data.sh            # 数据迁移
│   └── 📄 upgrade.sh                 # 版本升级
│
└── 📄 README.md                      # 项目说明
```

---

## 三、数据库设计 (Prisma Schema)

### 3.1 核心模型

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// 1. 租户（分支机构）
// ─────────────────────────────────────────────
model Tenant {
  id          String   @id @default(uuid())
  code        String   @unique // 机构编码，如 "SZ_001"
  name        String   // 机构名称
  type        TenantType // HQ(总部), BRANCH(分支机构)
  status      TenantStatus @default(ACTIVE)
  contactName String?  // 联系人
  contactPhone String? // 联系电话
  address     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]
  examPlans   ExamPlan[]
  candidates  Candidate[]
  auditLogs   AuditLog[]

  @@map("tenants")
}

enum TenantType {
  HQ      // 总部
  BRANCH  // 分支机构
}

enum TenantStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

// ─────────────────────────────────────────────
// 2. 用户
// ─────────────────────────────────────────────
model User {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  username  String
  password  String   // bcrypt哈希
  realName  String
  role      UserRole
  phone     String?
  email     String?
  status    UserStatus @default(ACTIVE)
  lastLoginAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  auditLogs AuditLog[]
  reminders Reminder[]

  @@unique([tenantId, username])
  @@map("users")
}

enum UserRole {
  SYS_ADMIN    // 系统管理员（极少）
  HQ_ADMIN     // 总部管理员
  HQ_STAFF     // 总部工作人员
  BRANCH_ADMIN // 分支机构管理员
  BRANCH_STAFF // 分支机构工作人员
  EXAMINER     // 考评员
  INSPECTOR    // 质量督导员
}

enum UserStatus {
  ACTIVE
  INACTIVE
  LOCKED
}

// ─────────────────────────────────────────────
// 3. 考评计划
// ─────────────────────────────────────────────
model ExamPlan {
  id          String     @id @default(uuid())
  tenantId    String
  tenant      Tenant     @relation(fields: [tenantId], references: [id])
  title       String     // 计划标题，如 "2026年Q2电工等级认定"
  examDate    DateTime   // 拟考日期
  profession  String     // 认定职业（工种）
  level       String     // 等级：1-5级
  examType    ExamType   // 认定方式
  location    String     // 考试地点
  maxCandidates Int      @default(0) // 计划人数
  status      PlanStatus @default(DRAFT)
  notes       String?    // 备注
  createdBy   String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  nodes       ExamNode[]
  candidates  Candidate[]
  archives    Archive[]

  @@map("exam_plans")
}

enum ExamType {
  THEORY      // 理论知识考试
  PRACTICE    // 技能考核
  COMPREHENSIVE // 综合评审
}

enum PlanStatus {
  DRAFT       // 草稿
  PENDING     // 待审批
  APPROVED    // 已审批
  REJECTED    // 已驳回
  PUBLISHED   // 已发布
  CANCELLED   // 已取消
}

// ─────────────────────────────────────────────
// 4. 考评节点（核心业务）
// ─────────────────────────────────────────────
model ExamNode {
  id          String     @id @default(uuid())
  planId      String
  plan        ExamPlan   @relation(fields: [planId], references: [id])
  nodeType    NodeType   // 节点类型（9大节点）
  deadline    DateTime   // 截止时间
  completedAt DateTime?  // 完成时间
  status      NodeStatus @default(PENDING)
  assignedTo  String?    // 负责人ID
  notes       String?    // 完成备注
  attachments String?    // 附件路径（JSON数组）
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  reminders   Reminder[]
  auditLogs   AuditLog[]

  @@map("exam_nodes")
}

// 9大考评节点
enum NodeType {
  PLAN_CREATE      // 1. 制定计划
  REGISTRATION     // 2. 考试报名
  ROOM_ARRANGE     // 3. 考场编排
  EXAM_PREPARE     // 4. 考务安排
  EXAM_DAY         // 5. 考试
  SCORE_RECORD     // 6. 成绩检录
  SCORE_PUBLISH    // 7. 成绩公示
  CERT_MANAGE      // 8. 证书管理
  COMPLETE         // 9. 完成认定
}

enum NodeStatus {
  PENDING     // 待执行
  IN_PROGRESS // 进行中
  COMPLETED   // 已完成
  OVERDUE     // 已逾期
  SKIPPED     // 已跳过（考前节点）
}

// ─────────────────────────────────────────────
// 5. 考生
// ─────────────────────────────────────────────
model Candidate {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  planId      String
  plan        ExamPlan @relation(fields: [planId], references: [id])
  name        String
  idCard      String   // 身份证号（加密存储）
  phone       String?
  gender      String   // M/F
  education   String?  // 学历
  workYears   Int?     // 工作年限
  photo       String?  // 照片路径
  applyLevel  String   // 申报等级
  status      CandidateStatus @default(PENDING)
  examRoom    String?  // 考场号
  seatNo      String?  // 座位号
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  score       Score?
  certificate Certificate?

  @@map("candidates")
}

enum CandidateStatus {
  PENDING     // 待审核
  APPROVED    // 已通过审核
  REJECTED    // 审核不通过
  EXAMINED    // 已考试
  PASSED      // 已通过
  FAILED      // 未通过
}

// ─────────────────────────────────────────────
// 6. 成绩
// ─────────────────────────────────────────────
model Score {
  id          String     @id @default(uuid())
  candidateId String     @unique
  candidate   Candidate  @relation(fields: [candidateId], references: [id])
  theoryScore Float?     // 理论成绩
  practiceScore Float?   // 实操成绩
  totalScore  Float?     // 总成绩
  isPass      Boolean    @default(false)
  evaluatedBy String?    // 考评员
  verifiedBy  String?    // 复核人
  evaluatedAt DateTime?
  verifiedAt  DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@map("scores")
}

// ─────────────────────────────────────────────
// 7. 证书
// ─────────────────────────────────────────────
model Certificate {
  id          String    @id @default(uuid())
  candidateId String    @unique
  candidate   Candidate @relation(fields: [candidateId], references: [id])
  certNo      String    @unique // 证书编号
  issueDate   DateTime? // 发证日期
  status      CertStatus @default(PENDING)
  issuedBy    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@map("certificates")
}

enum CertStatus {
  PENDING     // 待制证
  PRINTED     // 已打印
  ISSUED      // 已发放
  REISSUE_REQUESTED // 申请补办
}

// ─────────────────────────────────────────────
// 8. 档案
// ─────────────────────────────────────────────
model Archive {
  id          String    @id @default(uuid())
  planId      String
  plan        ExamPlan  @relation(fields: [planId], references: [id])
  filePath    String    // 档案文件路径
  fileSize    Int       // 文件大小
  sealHash    String    // 封存哈希（防篡改）
  status      ArchiveStatus @default(SEALED)
  createdAt   DateTime  @default(now())

  @@map("archives")
}

enum ArchiveStatus {
  SEALED    // 已封存
  OPENED    // 已启封
}

// ─────────────────────────────────────────────
// 9. 提醒
// ─────────────────────────────────────────────
model Reminder {
  id          String    @id @default(uuid())
  nodeId      String
  node        ExamNode  @relation(fields: [nodeId], references: [id])
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  type        ReminderType
  content     String
  scheduledAt DateTime  // 计划发送时间
  sentAt      DateTime? // 实际发送时间
  channel     String    // 发送渠道：IN_APP/SMS/EMAIL
  status      ReminderStatus @default(PENDING)
  createdAt   DateTime  @default(now())

  @@map("reminders")
}

enum ReminderType {
  NODE_START     // 节点开始提醒
  NODE_DEADLINE  // 节点截止提醒
  NODE_OVERDUE   // 节点逾期提醒
  SYSTEM_NOTICE  // 系统通知
}

enum ReminderStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}

// ─────────────────────────────────────────────
// 10. 审计日志（全操作留痕）
// ─────────────────────────────────────────────
model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  action      String   // 操作类型
  target      String   // 操作对象
  targetId    String?  // 对象ID
  oldValue    String?  // 修改前值
  newValue    String?  // 修改后值
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([userId, createdAt])
  @@map("audit_logs")
}
```

### 3.2 设计说明

- **多租户隔离**：所有业务表都有 `tenantId` 字段，通过中间件自动过滤
- **数据安全**：身份证号等敏感字段使用 AES 加密存储
- **防篡改**：档案封存时计算 SHA-256 哈希，任何修改都会被检测到
- **审计追踪**：所有增删改操作自动记录 `AuditLog`，不可删除

---

## 四、API 规范

### 4.1 统一响应格式

```typescript
// 所有API返回此格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;      // 错误码，如 "NODE_NOT_FOUND"
    message: string;   // 用户友好的错误消息
    details?: string;  // 详细说明（调试用）
  };
  meta?: {
    timestamp: string;   // ISO 8601
    requestId: string;   // 追踪ID
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

// 成功示例
{
  "success": true,
  "data": { "id": "xxx", "status": "COMPLETED" },
  "meta": { "timestamp": "2026-05-04T10:00:00Z", "requestId": "req_abc123" }
}

// 错误示例
{
  "success": false,
  "error": {
    "code": "NODE_OVERDUE",
    "message": "该节点已逾期，请联系管理员处理",
    "details": "节点ID: xxx, 截止时间: 2026-04-01"
  },
  "meta": { "timestamp": "2026-05-04T10:00:00Z", "requestId": "req_abc123" }
}
```

### 4.2 核心API列表

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录 | 公开 |
| POST | `/api/auth/logout` | 登出 | 已登录 |
| GET | `/api/auth/me` | 获取当前用户信息 | 已登录 |
| GET | `/api/dashboard` | 仪表盘数据聚合 | HQ_ADMIN+ |
| GET | `/api/exam-plans` | 考评计划列表 | 已登录 |
| POST | `/api/exam-plans` | 创建考评计划 | BRANCH_ADMIN+ |
| GET | `/api/exam-plans/:id` | 计划详情 | 已登录 |
| PATCH | `/api/exam-plans/:id` | 更新计划 | BRANCH_ADMIN+ |
| POST | `/api/exam-plans/:id/approve` | 审批计划 | HQ_ADMIN+ |
| GET | `/api/exam-nodes` | 考评节点列表 | 已登录 |
| POST | `/api/exam-nodes/:id/complete` | 完成节点 | BRANCH_ADMIN+ |
| GET | `/api/exam-nodes/:id/reminders` | 节点提醒记录 | 已登录 |
| GET | `/api/candidates` | 考生列表 | BRANCH_ADMIN+ |
| POST | `/api/candidates` | 添加考生 | BRANCH_ADMIN+ |
| POST | `/api/candidates/:id/approve` | 审核考生 | BRANCH_ADMIN+ |
| GET | `/api/scores` | 成绩列表 | EXAMINER+ |
| POST | `/api/scores` | 录入成绩 | EXAMINER+ |
| POST | `/api/scores/:id/verify` | 复核成绩 | HQ_ADMIN+ |
| GET | `/api/certificates` | 证书列表 | BRANCH_ADMIN+ |
| POST | `/api/certificates/:id/issue` | 发放证书 | BRANCH_ADMIN+ |
| GET | `/api/archives` | 档案列表 | HQ_ADMIN+ |
| POST | `/api/export/backup` | 一键备份 | SYS_ADMIN |
| POST | `/api/export/restore` | 一键恢复 | SYS_ADMIN |
| GET | `/api/export/download` | 下载备份 | SYS_ADMIN |
| GET | `/api/ai-ops/health` | 系统健康状态 | SYS_ADMIN |
| POST | `/api/ai-ops/backup` | AI执行备份 | SYS_ADMIN |
| POST | `/api/ai-ops/analyze` | AI分析日志 | SYS_ADMIN |
| GET | `/api/audit-logs` | 审计日志 | HQ_ADMIN+ |

### 4.3 中间件清单

| 中间件 | 用途 | 优先级 |
|--------|------|--------|
| `auth` | JWT认证，从Header提取token验证 | 高 |
| `tenant` | 多租户隔离，自动注入tenantId过滤 | 高 |
| `rbac` | 角色权限控制，检查用户角色是否允许访问 | 高 |
| `auditLog` | 自动记录所有写操作的审计日志 | 高 |
| `errorHandler` | 统一错误处理，转换为ApiResponse格式 | 高 |
| `rateLimit` | API限流，防止暴力请求 | 中 |

---

## 五、前端架构

### 5.1 页面路由

```typescript
// App.tsx 路由配置
const routes = [
  { path: '/login', component: Login, public: true },
  { path: '/', component: Dashboard, roles: ['HQ_ADMIN', 'BRANCH_ADMIN', 'HQ_STAFF', 'BRANCH_STAFF'] },
  { path: '/plans', component: ExamPlans, roles: ['HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/plans/:id', component: ExamPlanDetail, roles: ['HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/nodes', component: ExamNodes, roles: ['HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/candidates', component: Candidates, roles: ['BRANCH_ADMIN', 'BRANCH_STAFF'] },
  { path: '/scores', component: Scores, roles: ['EXAMINER', 'HQ_ADMIN', 'BRANCH_ADMIN'] },
  { path: '/certificates', component: Certificates, roles: ['BRANCH_ADMIN'] },
  { path: '/archives', component: Archives, roles: ['HQ_ADMIN'] },
  { path: '/ai-ops', component: AiOps, roles: ['SYS_ADMIN'] },
  { path: '/settings', component: Settings, roles: ['SYS_ADMIN', 'HQ_ADMIN'] },
];
```

### 5.2 关键组件规范

#### 节点卡片组件

```typescript
// NodeCard.tsx — 考评节点卡片
interface NodeCardProps {
  node: ExamNode;           // 节点数据
  plan: ExamPlan;           // 所属计划
  onComplete: () => void;   // 完成回调
  onViewDetail: () => void; // 查看详情
}

// 视觉状态
// PENDING → 灰色边框，显示倒计时
// IN_PROGRESS → 蓝色边框，闪烁提示
// COMPLETED → 绿色边框，打勾图标
// OVERDUE → 红色边框，警告图标，需要处理
```

#### 倒计时组件

```typescript
// DeadlineTimer.tsx — 节点倒计时
// 自动计算剩余工作日（排除周末和节假日）
// 显示格式：
//   > 7天 → "剩余X个工作日"（绿色）
//   3-7天 → "剩余X个工作日"（黄色）
//   < 3天 → "剩余X个工作日"（红色闪烁）
//   逾期 → "已逾期X天"（深红，需要处理）
```

### 5.3 Zustand Store 设计

```typescript
// stores/examStore.ts
interface ExamState {
  // 数据
  plans: ExamPlan[];
  currentPlan: ExamPlan | null;
  nodes: ExamNode[];
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // 操作
  fetchPlans: () => Promise<void>;
  fetchNodes: (planId: string) => Promise<void>;
  completeNode: (nodeId: string, data: CompleteData) => Promise<void>;
  
  // 派生状态（自动计算）
  getOverdueNodes: () => ExamNode[];
  getPendingNodes: () => ExamNode[];
  getNodesByPlan: (planId: string) => ExamNode[];
}
```

---

## 六、AI运维模块设计

### 6.1 运维面板布局

```
┌─────────────────────────────────────────────────────────────┐
│  🏠 首页   📊 仪表盘   ⚙️ 设置   🤖 AI运维中心              │
├──────────────────────┬──────────────────────────────────────┤
│  系统状态总览         │  🤖 AI运维助手                        │
│                      │                                      │
│  ✅ 数据库  正常      │  💬 试试这样问我：                     │
│  ✅ API服务 正常      │  • "帮我备份今天的数据"                 │
│  ✅ 定时任务 正常     │  • "系统运行正常吗？"                   │
│  ⚠️ 磁盘  85%       │  • "最近有什么异常？"                   │
│                      │  • "导出3月份的考评记录"                │
│  ──────────────────  │                                      │
│  今日动态            │  ┌────────────────────────────────┐  │
│  • 2个节点即将到期    │  │ AI: 系统运行正常。今日有2个考评节    │  │
│  • 15人完成报名       │  │ 点即将到期，建议关注。              │  │
│  • 自动备份 02:00     │  │                                │  │
│                      │  │ > [在此输入问题...          ] 📎 │  │
│  ──────────────────  │  └────────────────────────────────┘  │
│  快捷操作             │                                      │
│  ┌────┐┌────┐┌────┐ │  ─── 快捷操作 ─────────────────────  │
│  │🔄  ││💾  ││📦  │ │  ┌────────┐┌────────┐┌────────┐     │
│  │备份││恢复││导出│ │  │🔄 一键  ││💾 一键  ││📦 导出  │     │
│  └────┘└────┘└────┘ │  │  备份  ││  恢复  ││  数据  │     │
│                      │  └────────┘└────────┘└────────┘     │
└──────────────────────┴──────────────────────────────────────┘
```

### 6.2 AI运维接口设计

```typescript
// routes/ai-ops.ts

// GET /api/ai-ops/health — 系统健康检查
// 返回：{ cpu, memory, disk, dbStatus, apiLatency, uptime }

// POST /api/ai-ops/backup — 执行备份
// 请求：{ type: "full" | "data-only" }
// 返回：{ backupId, filePath, fileSize, createdAt }

// POST /api/ai-ops/restore — 执行恢复
// 请求：{ backupId }
// 返回：{ success, restoredAt }

// POST /api/ai-ops/analyze — AI分析
// 请求：{ query: "系统有什么异常？" }
// 返回：{ answer: "自然语言回答", actions: [...] }

// GET /api/ai-ops/backups — 备份列表
// 返回：{ backups: [{ id, type, size, createdAt, status }] }

// POST /api/ai-ops/export — 导出数据
// 请求：{ startDate, endDate, tenantId?, format: "pkg" | "csv" }
// 返回：{ downloadUrl, fileSize, expiresAt }
```

### 6.3 AI运维服务层

```typescript
// services/aiOpsService.ts

class AiOpsService {
  // 获取系统健康状态
  async getHealthStatus(): Promise<HealthStatus>;
  
  // 执行备份（支持全量/增量）
  async performBackup(type: BackupType): Promise<BackupResult>;
  
  // 从备份恢复
  async performRestore(backupId: string): Promise<RestoreResult>;
  
  // 自然语言查询分析
  async analyzeQuery(query: string): Promise<AiResponse>;
  
  // 获取备份列表
  async getBackups(): Promise<Backup[]>;
  
  // 导出数据
  async exportData(options: ExportOptions): Promise<ExportResult>;
  
  // 清理临时文件
  async cleanupTempFiles(): Promise<CleanupResult>;
  
  // 获取系统日志（支持过滤）
  async getLogs(options: LogOptions): Promise<LogEntry[]>;
}
```

---

## 七、Cursor/Codex 协作工作流

### 7.1 新增功能的标准流程

```
1. 打开 Cursor/Codex
   ↓
2. 粘贴 SKILL.md 作为上下文（或引用项目）
   ↓
3. 使用 Prompt 模板描述需求
   ↓
4. AI 生成代码
   ↓
5. 审查并调整
   ↓
6. 运行测试
   ↓
7. 提交代码
```

### 7.2 Prompt 模板

#### 模板1：新增API接口

```markdown
请根据以下规范为考评系统新增一个API接口：

【项目上下文】
- 技术栈：Express + TypeScript + Prisma + SQLite
- 所有API在 src/backend/src/routes/ 目录下
- 所有业务逻辑在 src/backend/src/services/ 目录下
- 使用统一的 ApiResponse 格式

【需求】
新增一个接口：批量导入考生
- 路由：POST /api/candidates/bulk-import
- 功能：接收CSV文件，批量创建考生记录
- 权限：BRANCH_ADMIN
- 校验：身份证格式、手机号格式、重复检查
- 返回：导入成功数、失败数、失败原因列表

【数据库模型参考】
Candidate 模型已有字段：name, idCard, phone, gender, education, workYears, applyLevel

【输出要求】
1. 路由文件代码
2. 服务层代码
3. 必要的工具函数（CSV解析、校验）
4. 在中间件中注册路由的代码
```

#### 模板2：新增前端页面

```markdown
请根据以下规范为考评系统新增一个前端页面：

【项目上下文】
- 技术栈：React 19 + TypeScript + Tailwind CSS + shadcn/ui + Zustand
- 页面在 src/frontend/src/pages/ 目录下
- 组件在 src/frontend/src/components/ 目录下
- 使用 Zustand 管理状态

【需求】
新增一个"证书查询"页面：
- 路径：/certificates/verify
- 公开页面（无需登录）
- 功能：输入姓名+身份证号，查询证书信息
- 显示：证书编号、职业、等级、发证日期、发证机构
- 样式：简洁专业，适合嵌入官网

【API参考】
GET /api/certificates/verify?name=xxx&idCard=xxx
返回：{ certNo, profession, level, issueDate, issuer }

【输出要求】
1. 页面组件代码
2. 路由配置
3. API调用Hook
```

#### 模板3：新增考评节点

```markdown
请为考评系统新增一个考评节点类型：

【项目上下文】
系统已有9个节点（见数据库schema中的 NodeType 枚举）

【需求】
新增节点："考前培训"
- 位置：在 REGISTRATION 和 ROOM_ARRANGE 之间
- 时限：考试前6个工作日
- 功能：记录培训完成情况
- 提醒：考前6天、3天、1天分别提醒

【需要修改的文件】
1. Prisma schema：NodeType 枚举
2. 节点配置：添加节点元数据
3. 前端：节点卡片样式
4. 提醒任务：新增提醒规则

【输出要求】
每个文件的修改内容（diff格式）
```

### 7.3 AI上下文注入

在 Cursor 中使用 `.cursorrules` 文件：

```
# .cursorrules — Cursor AI 行为规范

## 项目信息
- 项目名称：考评分支机构管理系统
- 技术栈：React 19 + TypeScript + Vite + Tailwind + shadcn/ui + Express + Prisma + SQLite
- 架构：多租户SaaS，总部集中部署

## 代码规范
1. 使用 TypeScript 严格模式
2. 前端使用函数式组件 + Hooks
3. 后端所有路由使用 async/await
4. API返回统一格式：{ success, data?, error?, meta? }
5. 所有数据库操作通过 Prisma Client
6. 敏感操作记录审计日志

## 命名规范
- 组件：PascalCase (ExamNodeCard.tsx)
- 函数：camelCase (completeNode)
- 常量：UPPER_SNAKE_CASE (MAX_PAGE_SIZE)
- 类型：PascalCase + 后缀 (CompleteNodeRequest)
- 文件：与默认导出同名

## 重要约束
- 禁止在前端暴露数据库结构
- 禁止在后端拼接SQL
- 所有用户输入必须校验
- 多租户场景必须过滤tenantId
```

---

## 八、定时任务设计

### 8.1 提醒任务调度

```typescript
// jobs/reminders.ts

// 每分钟执行一次检查
schedule('*/1 * * * *', async () => {
  // 1. 检查是否有节点即将到期（考前提醒）
  // 2. 检查是否有节点已逾期（逾期提醒）
  // 3. 检查是否有节点需要启动（节点开始提醒）
  // 4. 生成提醒记录
  // 5. 发送提醒（系统内消息/邮件/短信）
});

// 每天凌晨2点执行自动备份
schedule('0 2 * * *', async () => {
  // 1. 执行数据库备份
  // 2. 清理过期备份（保留30天）
  // 3. 发送备份完成通知
});

// 每天凌晨3点执行数据清理
schedule('0 3 * * *', async () => {
  // 1. 清理临时文件
  // 2. 归档历史审计日志
  // 3. 生成每日统计报表
});
```

### 8.2 提醒规则配置

```typescript
// 节点类型 → 提醒规则映射
const REMINDER_RULES: Record<NodeType, ReminderRule[]> = {
  PLAN_CREATE: [
    { daysBefore: 10, type: 'NODE_START', message: '请制定考评计划' },
    { daysBefore: 3, type: 'NODE_DEADLINE', message: '制定计划即将到期' },
    { daysBefore: 0, type: 'NODE_OVERDUE', message: '制定计划已逾期' },
  ],
  REGISTRATION: [
    { daysBefore: 7, type: 'NODE_START', message: '考试报名已开始' },
    { daysBefore: 2, type: 'NODE_DEADLINE', message: '报名即将截止' },
    { daysBefore: 0, type: 'NODE_OVERDUE', message: '报名已截止' },
  ],
  // ... 其他节点
};
```

---

## 九、部署配置

### 9.1 Docker Compose

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ../src/backend
      dockerfile: ../../docker/Dockerfile.backend
    ports:
      - "3001:3001"
    volumes:
      - exam-data:/app/data       # SQLite数据库
      - exam-files:/app/files     # 上传文件
      - exam-config:/app/config   # 配置文件
      - exam-backups:/app/backups # 备份目录
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/exam.db
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    restart: unless-stopped

  frontend:
    build:
      context: ../src/frontend
      dockerfile: ../../docker/Dockerfile.frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

  # 自动备份服务（可选，独立容器）
  backup:
    build:
      context: ../src/backend
      dockerfile: ../../docker/Dockerfile.backend
    volumes:
      - exam-data:/app/data:ro
      - exam-backups:/app/backups
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/exam.db
    command: ["node", "dist/jobs/backups.js"]
    restart: unless-stopped

volumes:
  exam-data:
  exam-files:
  exam-config:
  exam-backups:
```

### 9.2 环境变量

```bash
# .env 文件
NODE_ENV=production
PORT=3001

# 数据库
DATABASE_URL="file:./data/exam.db"

# 安全
JWT_SECRET=your-super-secret-jwt-key-change-this
ENCRYPTION_KEY=your-32-char-encryption-key-here

# 备份
BACKUP_RETENTION_DAYS=30
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_TIME=02:00

# 提醒
REMINDER_ENABLED=true
SMS_ENABLED=false      # 如需短信，配置服务商
EMAIL_ENABLED=false    # 如需邮件，配置SMTP
```

---

## 十、开发优先级（MVP → 完整版）

### Phase 1: MVP核心（6-8周）

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 认证 | 登录/登出/角色区分 | P0 |
| 仪表盘 | 节点状态总览/倒计时 | P0 |
| 考评计划 | CRUD + 审批流 | P0 |
| 考评节点 | 9节点追踪/完成/逾期 | P0 |
| 提醒 | 系统内消息提醒 | P0 |
| 考生 | 基础信息管理 | P0 |
| AI运维 | 备份/恢复/健康检查 | P0 |

### Phase 2: 业务完善（4-6周）

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 成绩 | 录入/复核/上报 | P1 |
| 证书 | 赋码/制证/发放 | P1 |
| 公示 | 自动生成/发布 | P1 |
| 档案 | 归档/封存/检索 | P1 |
| 导出 | 数据导出/报表 | P1 |

### Phase 3: 智能化（3-4周）

| 模块 | 功能 | 优先级 |
|------|------|--------|
| AI助手 | 自然语言运维 | P2 |
| 统计 | 多维度报表 | P2 |
| 移动端 | H5适配 | P2 |
| 集成 | 短信/邮件/钉钉 | P2 |

---

## 十一、数据量评估与容量规划

基于您的规模（年考评1200人、5分支、8年保留）：

| 数据项 | 年增量 | 8年总量 | 存储估算 |
|--------|--------|---------|---------|
| 考生记录 | 1200条 | 9600条 | ~5MB |
| 考评计划 | 20-50条 | 400条 | ~1MB |
| 考评节点 | 180-450条 | 3600条 | ~2MB |
| 成绩记录 | 1200条 | 9600条 | ~3MB |
| 证书记录 | 1200条 | 9600条 | ~2MB |
| 审计日志 | 10000条 | 80000条 | ~40MB |
| 上传文件 | - | - | ~500MB-2GB |
| **总计** | - | - | **~1-3GB** |

> SQLite 在 1-3GB 数据量下性能完全无压力。如果未来超过 10GB，可平滑迁移到 PostgreSQL（Prisma 支持一键切换数据源）。

---

## 附录：Cursor 开发快速开始

### 步骤1：打开项目
```bash
cd exam-system
```

### 步骤2：在 Cursor 中提问

```
我要新增一个功能：考评计划支持附件上传。
请根据 SKILL.md 中的规范生成：
1. 数据库迁移（添加附件字段）
2. 后端API（上传/下载/删除附件）
3. 前端组件（上传按钮+文件列表）
```

### 步骤3：AI生成代码 → 审查 → 测试 → 提交

---

> 本文档是项目的"活宪法"，会随着开发迭代持续更新。每次新增功能、调整架构时，同步更新此文档，确保AI助手始终拥有准确的上下文。
