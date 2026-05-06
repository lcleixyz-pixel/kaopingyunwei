# AI开发上下文 — 快速参考

> 用途：粘贴给 Cursor / Codex / ChatGPT 作为项目上下文  
> 长度：精简版，只包含最关键的信息

---

## 项目

**考评分支机构管理系统** — 职业技能等级认定考务全流程管理系统
- 技术栈：React 19 + TypeScript + Vite + Tailwind + shadcn/ui + Express + Prisma + SQLite
- 架构：多租户SaaS，总部集中部署，Docker一键启动
- 用户：唯一非专业运维人员，通过AI运维面板管理系统

## 数据库（Prisma）

核心表：`Tenant`（分支机构）→ `User`（用户）→ `ExamPlan`（考评计划）→ `ExamNode`（9大节点）→ `Candidate`（考生）→ `Score`（成绩）→ `Certificate`（证书）→ `Archive`（档案）→ `Reminder`（提醒）→ `AuditLog`（审计）

所有业务表都有 `tenantId` 字段实现多租户隔离。敏感字段（身份证等）AES加密。

## 9大考评节点

1. PLAN_CREATE（制定计划）D-10工作日
2. REGISTRATION（考试报名）D-7工作日
3. ROOM_ARRANGE（考场编排）D-5工作日
4. EXAM_PREPARE（考务安排）D-5工作日
5. EXAM_DAY（考试当天）D-Day
6. SCORE_RECORD（成绩检录）D+3工作日
7. SCORE_PUBLISH（成绩公示）D+5工作日（≥5天公示期）
8. CERT_MANAGE（证书管理）D+10工作日
9. COMPLETE（完成认定）D+10工作日

考前节点参考执行，考后节点强制执行。

## API规范

统一响应：`{ success: boolean, data?: T, error?: { code, message }, meta?: { timestamp, requestId } }`

中间件顺序：auth → tenant → rbac → auditLog → handler → errorHandler

## 前端规范

- 函数式组件 + Hooks
- Zustand状态管理
- shadcn/ui组件库 + Tailwind CSS
- 页面在 `src/frontend/src/pages/`
- 组件在 `src/frontend/src/components/`
- API请求统一用 `useApi` hook

## 开发规范

- TypeScript严格模式
- 后端所有路由async/await
- 数据库操作必须通过Prisma Client
- 禁止拼接SQL
- 敏感操作记录审计日志
- 多租户必须过滤tenantId

## 命名规范

组件PascalCase、函数camelCase、常量UPPER_SNAKE_CASE、类型PascalCase+后缀、文件与默认导出同名
