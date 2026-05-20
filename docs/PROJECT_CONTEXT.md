# Project Context

## 项目定位

本项目是“考评分支机构管理系统”，服务于国家珠宝玉石首饰检验集团有限公司对各分支考评业务的内部统筹。各机构真实业务仍发生在当地上级部门各自指定的业务系统中；本系统不替代那些地方系统，而是用于分支提前报备计划、整理考生资料、追踪节点进度，并导出符合当地上级部门和总部要求的报表。

当前目标不是一次性做成大型平台，而是先交付一个生产可用 MVP，让总部和分支机构可以完成从计划创建、报名资料整理、节点追踪、模板导出、上传回填到总部监管报表的内部闭环。

## 当前技术基线

- 应用目录：`app/`
- 前端：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand
- 后端：Express + TypeScript + Prisma
- 数据库：SQLite，MVP 阶段继续使用
- 部署基线：Docker + SQLite
- 本地开发端口：
  - 前端开发：`npm run dev`
  - 后端开发：`npm run backend:dev`
  - 编译后单服务验证：`npm run check && npm run backend:start`
- 统一验证命令：
  - `npm run check`
  - `npm run lint`
  - `npx prisma migrate status --schema src/backend/prisma/schema.prisma`

## 初始化账号

| 角色 | 用户名 | 密码来源 | 用途 |
| --- | --- | --- | --- |
| 系统管理员 | `admin` | `SEED_USER_PASSWORDS_JSON` 或受控密码管理器 | 全局初始化、系统配置、AI 运维 |
| 总部管理员 | `hqadmin` | `SEED_USER_PASSWORDS_JSON` 或受控密码管理器 | 总部监管、跨机构统计和审批 |
| 分部管理员 | `bjadmin` | `SEED_USER_PASSWORDS_JSON` 或受控密码管理器 | 分支计划、考生和节点管理 |
| 分部工作人员 | `bjstaff` | `SEED_USER_PASSWORDS_JSON` 或受控密码管理器 | 分支日常考务、意向考生和资料维护 |

## 核心业务闭环

MVP 必须优先保证以下流程能走通：

1. 用户登录并进入仪表盘。
2. 分支先收集意向考生，必要时转为正式考生。
3. 管理员创建考评计划。
4. 系统自动生成 9 个考评节点。
5. 分支可添加和审核正式考生。
6. 分支按当地官方 Excel 模板补全考生 33 项报名字段、材料清单和审核状态。
7. 节点可按业务进度完成或逾期提醒。
8. 分支可导出当地系统上传用 `.xls` 报名表，并回填上传状态。
9. 总部可跨机构查看计划、节点、考生、材料齐全、审核通过和上传状态，不查看缴费状态。
10. 后续再补齐成绩、证书、档案和 AI 运维生产化能力。

## 9 大考评节点

| 阶段 | 节点 | 枚举 |
| --- | --- | --- |
| 考前 | 制定计划 | `PLAN_CREATE` |
| 考前 | 考试报名 | `REGISTRATION` |
| 考前 | 考场编排 | `ROOM_ARRANGE` |
| 考前 | 考务安排 | `EXAM_PREPARE` |
| 考中 | 考试 | `EXAM_DAY` |
| 考后 | 成绩检录 | `SCORE_RECORD` |
| 考后 | 成绩公示 | `SCORE_PUBLISH` |
| 考后 | 证书管理 | `CERT_MANAGE` |
| 考后 | 完成认定 | `COMPLETE` |

## 协作协议

每次新的开发回合开始前，AI 必须先读这些文档：

1. `docs/AI_HANDOFF.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/BUSINESS_RULES.md`
4. `docs/ROLE_MATRIX.md`
5. `docs/API_CONVENTIONS.md`
6. `docs/ACCEPTANCE_CHECKLIST.md`
7. `docs/DECISIONS.md`

每次开发结束前，AI 必须更新 `docs/AI_HANDOFF.md`，记录：

- 本轮完成内容
- 验证命令和结果
- 浏览器验证页面
- 未完成事项和风险
- 下一轮建议入口

## 防走偏原则

- 不把聊天记录当唯一记忆，重要规则写回 `docs/`。
- 不把 `src/backend/dist` 当源码入口，它是生成物。
- 不绕过租户隔离、角色权限和审计日志。
- 不为了“看起来完整”引入重型架构；MVP 先维持现有 `app/` 结构。
- 不把总部跨机构查询混进普通分支接口；总部聚合能力应单独设计。
- 不在生产环境使用默认密钥或默认密码。
