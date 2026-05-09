# API Conventions

## 统一响应格式

所有新接口必须保持统一响应结构：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

错误响应：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "无权限访问"
  },
  "meta": {}
}
```

## 认证与鉴权

所有业务接口默认需要认证：

- 使用 `authenticate` 解析 JWT。
- 使用 `requireRoles('ROLE_A', 'ROLE_B')` 限制角色。
- `requireRoles` 已兼容数组形式，但新增代码优先使用展开参数形式。

允许匿名访问的接口应非常少：

- `GET /api/health`
- `POST /api/auth/login`

## 租户隔离

普通业务查询必须带租户过滤：

- `ExamPlan.tenantId = req.tenantId`
- `Candidate.tenantId = req.tenantId`
- 通过计划、考生关联查询成绩、证书、档案时，也必须确保关联对象属于当前租户。

总部跨机构统计必须单独设计接口，不混用分支接口。

## 审计日志

新增写操作必须记录审计日志，至少包含：

- `tenantId`
- `userId`
- `action`
- `target`
- `targetId`
- `oldValue` 或 `newValue`
- `ipAddress`
- `userAgent`

优先使用现有 `recordAudit(req, ...)` 工具。

必须审计的操作：

- 计划创建、审批、发布、取消
- 节点完成、跳过、恢复
- 考生新增、审核、驳回
- 成绩录入、修改、复核
- 证书生成、打印、发放、补办
- 档案封存、调阅
- 设置保存
- 备份、恢复、导出、下载迁移包

## 当前接口组

| 接口组 | 用途 |
| --- | --- |
| `/api/auth` | 登录、当前用户 |
| `/api/dashboard` | 仪表盘统计和报表 |
| `/api/prospective-candidates` | 分支内部意向考生 |
| `/api/exam-plans` | 考评计划 |
| `/api/exam-nodes` | 节点追踪 |
| `/api/candidates` | 考生管理 |
| `/api/scores` | 成绩管理 |
| `/api/certificates` | 证书管理 |
| `/api/archives` | 档案管理 |
| `/api/reminders` | 提醒列表和数量 |
| `/api/settings` | 系统配置 |
| `/api/ai-ops` | 运维健康、备份、恢复、导出、日志 |

## 意向考生接口约定

- `GET /api/prospective-candidates`：查询本分支意向考生，支持姓名、手机号、状态搜索。
- `POST /api/prospective-candidates`：新增意向考生，姓名和手机号必填。
- `PATCH /api/prospective-candidates/:id`：编辑本分支意向考生。
- `DELETE /api/prospective-candidates/:id`：彻底删除，仅 `BRANCH_ADMIN`。
- `POST /api/prospective-candidates/:id/convert`：选择本分支已发布计划并补充正式考生最小必填字段，生成正式考生。

权限要求：

- 全部意向考生接口必须认证。
- 仅 `BRANCH_ADMIN`、`BRANCH_STAFF` 可访问；删除仅 `BRANCH_ADMIN`。
- 查询和写入必须按 `tenantId` 隔离。
- 写操作必须写审计日志。

## 新接口设计规则

- 路径使用名词复数，例如 `/api/scores`。
- 列表接口使用 `GET /api/resources`。
- 创建接口使用 `POST /api/resources`。
- 单条更新使用 `PATCH /api/resources/:id`。
- 删除接口仅在业务确认需要时添加，优先使用状态流转。
- 所有日期使用 ISO 字符串传输。
- 金额、分数、计数等数值字段保持 number，不用字符串。
- 前后端共享类型优先放入 `app/src/shared/index.ts`。

## AI 运维导出约定

- `POST /api/ai-ops/export` 负责生成迁移包。
- `GET /api/ai-ops/download/:fileName` 负责下载迁移包。
- 导出包应包含：
  - SQLite 数据库
  - 上传文件目录
  - 元数据
  - 恢复说明

## 前端调用约定

- 页面不直接拼装重复认证逻辑，优先使用现有 API hook 或 axios 配置。
- 页面必须处理加载中、空状态和错误提示。
- 不能用固定数字替代真实接口数据。
- 权限不可见或不可点的状态要跟角色矩阵一致。
