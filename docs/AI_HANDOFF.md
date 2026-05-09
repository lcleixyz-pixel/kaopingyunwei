# AI Handoff

## 使用方式

每次新会话或上下文压缩后，先读本文件，再读：

1. `docs/PROJECT_CONTEXT.md`
2. `docs/BUSINESS_RULES.md`
3. `docs/ROLE_MATRIX.md`
4. `docs/API_CONVENTIONS.md`
5. `docs/ACCEPTANCE_CHECKLIST.md`
6. `docs/DECISIONS.md`

本文件是项目当前状态的“交接班记录”。不要只依赖聊天上下文继续开发。

## 当前日期

记录日期：2026-05-09

## 当前阶段

项目正在推进 Phase 1.2：意向考生模块与考评计划字段重梳。

当前应继续聚焦“分支提前收集意向考生、报备计划、整理正式考生资料、总部追踪进度、导出地方系统报表”闭环，不要扩散到学员端、大模型运维、邮件短信、附件上传或完整成绩证书档案流程。

## 最近完成内容

工程基线：

- 前端构建已通过。
- 后端 TypeScript 编译已通过。
- `requireRoles` 已兼容展开参数和数组形式。
- Express 类型、`tsx`、后端 build/start 脚本已整理。
- `.env` 和 `.env.example` 使用 SQLite 数据库路径 `file:../../../data/exam.db`。
- Docker Compose 已改为显式读取 `../.env`，数据卷挂载到 `/app/data/files` 和 `/app/data/backups`。
- 已新增 `app/.dockerignore`，避免把 `node_modules`、`dist`、`data` 等大目录发送进 Docker 构建上下文。
- `scripts/start.sh` 和 `scripts/stop.sh` 已优先使用现代 `docker compose`，并传入 `--env-file .env`。
- `src/backend/dist` 继续视为生成物，不作为源码入口。

后端：

- 新增或完善 `/api/scores`、`/api/certificates`、`/api/archives`、`/api/reminders`、`/api/settings`。
- `/api/ai-ops/export` 已配套下载接口。
- AI 运维健康检查读取真实数据库和磁盘信息。
- 敏感字段加密已改为 AES-256-GCM，并保留旧数据 fallback。
- 计划、节点、考生、成绩、证书、档案、设置、运维操作已接入审计日志工具。

前端：

- `Scores`、`Certificates`、`Archives` 已从占位页替换为真实页面。
- `Dashboard` 使用真实提醒数量和报表接口。
- `Sidebar` 使用 `/api/reminders/count`。
- `Settings` 已接入 `/api/settings`。
- `AiOps` 显示真实健康状态，并支持迁移包下载入口。

文档：

- 新增项目护栏文档：
  - `docs/PROJECT_CONTEXT.md`
  - `docs/BUSINESS_RULES.md`
  - `docs/ROLE_MATRIX.md`
  - `docs/API_CONVENTIONS.md`
  - `docs/ACCEPTANCE_CHECKLIST.md`
  - `docs/AI_HANDOFF.md`
  - `docs/DECISIONS.md`

Phase 1.1：

- 已明确项目定位：本系统不替代当地上级部门业务系统，而是服务于国家珠宝玉石首饰检验集团有限公司总部和各分支之间的计划报备、资料整理、进度追踪和报表导出。
- 新增 `CandidateRegistrationProfile`，保存 33 列模板字段、材料清单、审核信息和分支私有缴费状态。
- 新增 `LocalUploadBatch`，记录计划级地方系统上传状态、上传时间、操作人和备注。
- 考生录入和资料维护已对齐 `/模版/考生信息模板.xls` 的 33 列字段。
- `/api/candidates/export` 已改为严格导出 `.xls`：第 1 行为原模板表头，第 2 行起为符合闸门的考生数据，不导出示例行和说明行。
- 导出/审核闸门已实现：模板必填项、材料清单、审核状态共同控制；“是否有职业资格证书=是”时才强制原证书材料、证书等级和证书编号。
- 缴费状态只允许 `BRANCH_ADMIN`、`BRANCH_STAFF` 查看/修改；`SYS_ADMIN`、总部角色 API 和页面均不可见。
- 已修复系统管理员无法保存报名资料的问题：`SYS_ADMIN` 可维护 33 项模板字段和材料清单，但仍不可见、不可修改缴费状态；总部角色继续只读监管。
- 新增 `/api/candidates/:id/registration-profile` 读写报名资料。
- 新增 `/api/exam-plans/:id/local-upload-batches` 记录地方系统上传回填。
- 新增 `/api/hq/reports/registration-progress`，总部报表展示计划、节点、考生、材料齐全、审核通过、可导出和上传状态，不包含缴费字段。
- 前端 `Candidates` 已改为“报名资料工作台”，包含 33 项字段弹窗、材料清单、导出 `.xls`、上传回填和缴费权限隐藏。
- 前端 `Dashboard` 已增加总部报名资料进度表。
- 已更新 `docs/PROJECT_CONTEXT.md`、`docs/BUSINESS_RULES.md`、`docs/ROLE_MATRIX.md`。

Phase 1.2：

- 新增“意向考生”模块，导航排序位于“仪表盘”和“考评计划”之间。
- 新增 `ProspectiveCandidate` 数据模型，字段包括租户、姓名、手机号、意向职业、意向工种、意向等级、来源、跟进状态、备注、转正式后的正式考生 ID、创建/更新时间。
- 新增 `/api/prospective-candidates` 接口组：
  - `GET /api/prospective-candidates`
  - `POST /api/prospective-candidates`
  - `PATCH /api/prospective-candidates/:id`
  - `DELETE /api/prospective-candidates/:id`
  - `POST /api/prospective-candidates/:id/convert`
- 意向考生仅 `BRANCH_ADMIN`、`BRANCH_STAFF` 可见可用；彻底删除仅 `BRANCH_ADMIN`；`SYS_ADMIN`、总部角色无页面和接口访问权。
- 同一分支内重复手机号允许保存，前端负责提示。
- 转正式只能选择本分支已发布计划，并要求补身份证号、性别等正式考生最小必填字段；创建正式考生后自动带入计划的职业、职业工种名称、等级和报名单位，再到报名资料工作台补齐 33 项模板资料。
- 意向考生页面默认筛选为“跟进中”，不是“全部”。
- 考评计划页面默认筛选为“已发布”，筛选顺序为“已发布、草稿、全部、已取消”；人数列改为“已报/上限”，避免把上限误读为实际人数。
- 草稿计划可以编辑、发布、取消；草稿不能转入意向考生，也不能直接新增正式考生。
- 已发布计划可以转入意向考生和新增正式考生；已发布不能直接取消，必须先回退到草稿。
- 回退已发布计划时，该计划下所有正式考生转为意向考生“跟进中”，并删除原正式考生记录；原本由意向考生转入的记录解除 `convertedCandidateId`，直接新增的正式考生会生成新的意向考生。
- 取消计划前必须系统自检无正式考生，并填写取消备注；只有草稿计划可以取消。
- 报名资料工作台默认必须先选择已发布考评计划，不再无计划时加载全部考生；计划下拉只显示已发布计划，不显示草稿或已取消计划。
- 审核驳回正式考生时，会将其转回意向考生“跟进中”并删除正式考生记录；来自意向转正式的记录恢复原意向考生，直接新增的正式考生会生成或复用同姓名、手机号的意向考生。
- 考评计划字段已重梳：新增“职业”和“报名截止日期”，`profession` 语义固定为“职业工种名称”，移除“认定方式/考试类型 examType”。
- 等级已统一为完整表述：`一级/高级技师`、`二级/技师`、`三级/高级工`、`四级/中级工`、`五级/初级工`。
- 当前职业映射已按等级固化：
  - 职业“贵金属首饰与宝玉石检测员”：五级/初级工仅可选“贵金属首饰与宝玉石检测员”。
  - 职业“贵金属首饰与宝玉石检测员”：一级至四级仅可选“贵金属首饰检验员、钻石检验员、宝石检验员、玉石检验员、有机宝石检验员”。
  - 职业“首饰设计师”：工种“首饰设计师”。
- 报名资料固定选项已实现：文化程度、所在省（市）区、考生来源、报名单位、认定分类、考试类型。
- 参加工作时间、电子邮箱、户籍所在地、政治面貌、学历证书编号、简要经历、通讯地址、邮政编码、邮寄地址均为非必填项，不影响审核通过。
- 本地 SQLite 和 Docker SQLite 已按当前开发环境重置并重新 seed 默认租户和默认账号；不设计自动清生产数据脚本。
- Docker 后端启动已修复 fresh SQLite 文件不存在时 Prisma `migrate deploy` 失败的问题：容器启动前先确保 `/app/data/exam.db` 文件存在。
- `seed.ts` 已清理演示计划/演示考生，只保留默认租户和默认账号。
- `docs/PROJECT_CONTEXT.md`、`docs/BUSINESS_RULES.md`、`docs/ROLE_MATRIX.md`、`docs/API_CONVENTIONS.md`、`docs/ACCEPTANCE_CHECKLIST.md` 已同步本轮规则。

Phase 1.3 节点追踪与报名阶段关闭：

- 节点追踪页面已从“节点列表”改为“按考试计划管理”：只展示已发布且未达到“完成认定”的计划，并按考试日期由近到远排序。
- `/api/exam-plans` 列表和详情返回计划节点，并新增派生字段 `registrationClosed`，表示“考试报名”节点是否已完成。
- 发布草稿计划时，系统会自动登记“制定计划”节点为已完成，并将“考试报名”节点置为进行中。
- 报名资料工作台点选“上传回填”时会询问是否确认结束考试报名阶段；确认后创建上传回填记录，同时完成“考试报名”节点并激活下一个节点。
- “考试报名”节点完成后，后端阻止继续直接新增正式考生，也阻止意向考生转正式；前端同步禁用新增入口，并从意向转正式计划列表中排除报名已结束计划。
- 审核通过的考生资料再次保存前，前端会提示使用者确认本地上级部门业务系统信息已同步保持一致。

## 最近验证结果

最近一轮 Phase 1.3 命令验证：

- `npm run backend:test`：通过，31 个测试；新增覆盖发布时自动完成“制定计划”、报名节点完成后关闭新增/转入、节点追踪计划筛选和按考试日期排序。
- `npm run backend:build`：通过。
- `npm run build`：通过。
- `npm run phase1:smoke`：通过；新增覆盖上传回填确认结束报名后，“考试报名”节点完成、“考场编排”节点进入进行中、继续新增正式考生被阻断、意向考生转正式被阻断。
- `npm run check`：通过。
- `npx prisma validate --schema src/backend/prisma/schema.prisma`：通过。
- `npx prisma migrate status --schema src/backend/prisma/schema.prisma`：通过，数据库 schema 与 migrations 一致。
- `docker compose --env-file .env -f docker/docker-compose.yml config`：通过。
- `EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up --build -d`：通过，前后端镜像重建，`exam-backend` healthy。
- `GET http://localhost:8080/api/health`：通过。
- `API_BASE_URL=http://localhost:8080/api npm run phase1:smoke`：通过，确认 Docker 入口同样满足上传回填关闭报名、阻断新增和阻断意向转正式。
- Chrome 打开 `http://localhost:8080/nodes`：通过；强制刷新后确认节点追踪页按计划展示，显示进行中计划、待完成节点、逾期计划，计划卡片显示“当前：考场编排”“2/9 已完成”“报名已结束”。
- Chrome 打开 `http://localhost:8080/candidates`：通过；选择报名已结束计划后，“新增考生”禁用并显示“考试报名阶段已结束”，计划下拉项标记“报名已结束”。
- Chrome 在已审核通过考生资料弹窗中点击保存：通过；出现“确认本地业务系统中的信息已同步保持一致”的确认提醒，已取消保存未写入。

上一轮 Phase 1.2 命令验证：

- `npm run backend:test`：通过，27 个测试；包含报名资料工作台先选计划、只展示已发布计划、计划字段、按等级限制工种、固定选项字典、非必填字段、固定选项非法值阻断、意向考生权限、重复手机号允许、删除权限、转正式、审核驳回转回意向并移除正式考生、计划回退/取消规则、模板 33 列、`.xls` 导出、条件材料、默认映射和缴费隐藏规则。
- `npm run build`：通过。
- `npm run backend:build`：通过。
- `npx prisma validate --schema src/backend/prisma/schema.prisma`：通过。
- `npx prisma migrate status --schema src/backend/prisma/schema.prisma`：通过，数据库 schema 与 migrations 一致。
- 此前本地 SQLite 已重置后重新 seed：通过，结果为 3 个租户、5 个默认用户、0 个计划、0 个正式考生、0 个意向考生。
- 此前 `EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml down -v`：通过，已清理当前开发 Docker 数据卷。
- `EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up --build -d`：通过，后端 healthy，前端启动。
- `GET http://localhost:8080/api/health`：通过。
- `API_BASE_URL=http://localhost:8080/api npm run phase1:smoke`：通过；覆盖创建计划、9 节点、草稿禁止新增正式考生、发布后新增/转正式、完整考生资料、缴费权限隐藏、审核、导出 `.xls`、上传回填、总部报表、意向考生新增、重复手机号保存、工作人员删除拒绝、管理员删除、审核驳回后回到跟进中且正式考生不再显示、已发布禁止直接取消、回退后转回跟进中并移除正式考生、空草稿填写备注后取消。
- 本轮冒烟测试通过后，已删除本轮固定 smoke 测试痕迹（`Phase1 Smoke 1778299685766` 计划、同后缀测试意向考生），保留浏览器中已有业务数据。

API 验证：

- `GET /api/health`：通过。
- `POST /api/auth/login` 使用 `admin/admin123`：通过。
- `/api/dashboard`：通过。
- `/api/dashboard/reports`：通过。
- `/api/reminders/count`：通过。
- `/api/scores`：通过。
- `/api/certificates`：通过。
- `/api/archives`：通过。
- `/api/settings`：通过。
- `/api/ai-ops/health`：通过。

最近一轮浏览器验证，发生在最终清库之前：

- 使用 Chrome 打开 `http://localhost:8080`。
- 使用 `bjadmin/bjadmin123` 登录。
- 已确认分支导航顺序为“仪表盘 -> 意向考生 -> 考评计划”。
- 已打开 `http://localhost:8080/prospective-candidates`，页面加载正常。
- 已确认进入意向考生页面默认选中“跟进中”，不再默认选中“全部”。
- 已确认旧数据中 `3` 这种历史等级会在页面展示为“三级/高级工”。
- 已确认意向考生列表可以显示 smoke 测试产生的已转正式记录，并展示姓名、手机号、意向职业/工种/等级、跟进状态和关联计划。
- 已确认分支管理员页面显示新增、编辑、删除等操作入口。
- 最终清库后，浏览器若仍停留在旧页面，需要刷新后重新登录。

Docker 验证：

- `docker --version`：Docker version 29.4.2。
- `docker compose version`：Docker Compose version 5.1.3。
- `docker compose --env-file .env -f docker/docker-compose.yml config`：通过。
- `EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up --build`：后端和前端镜像构建通过。
- 后端容器启动后成功创建 fresh SQLite 文件、执行 Prisma migration 和 seed，`exam-backend` 状态为 healthy。
- 前端容器通过 `localhost:8080` 提供服务。
- `GET http://localhost:8080/api/health`：通过。
- `POST http://localhost:8080/api/auth/login` 使用 `admin/admin123`：通过。
- Chrome 打开 `http://localhost:8080`，默认账号登录成功。
- Chrome 打开 `http://localhost:8080/ai-ops`，AI 运维页显示容器内真实健康状态。

未完成验证：

- 尚未用浏览器逐项点击验证意向考生新增、编辑、重复手机号确认、删除和转正式弹窗；API smoke 已覆盖这些行为。
- 尚未用浏览器登录总部/系统管理员确认意向考生菜单不可见；API smoke 已覆盖接口 403。
- 尚未用浏览器登录分支账号逐项验证缴费列可见、可改以及上传回填按钮。
- 尚未完整走一条“计划 -> 节点 -> 考生 -> 成绩 -> 证书 -> 档案”的写入型 happy path。
- 尚未用多个角色逐项验证页面权限和 API 权限。
- 尚未用浏览器验证北京分部与上海分部之间的数据隔离。

## 已知风险

- 当前项目目录没有检测到 Git 元数据，无法依靠 `git status` 做变更保护。修改前后需要用文件清单和人工说明控制范围。
- README 中仍有部分描述偏理想化，例如 AI 运维“自然语言交互”，实际 MVP 当前是规则化运维面板。
- Docker 构建时 npm audit 提示依赖存在漏洞，需要后续专项评估，不能直接盲目 `npm audit fix`。
- Docker 首次构建曾因网络 `ECONNRESET` 在 Prisma engines 下载阶段失败；重试后通过，判断为环境网络波动。
- 成绩、证书、档案已具备基础能力，但还需要按真实业务补字段、批量导入、打印模板、调阅记录等细节。
- 权限矩阵需要业务方确认后再精细化。
- 模板必填项根据模板说明和当前业务规则固化在代码中；原 `.xls` 的红色必填样式未被程序直接读取。若后续获得更明确官方说明，需要同步更新 `candidateRegistration.ts` 的必填字段列表和测试。
- Chrome 浏览器可能缓存旧前端 bundle；页面异常时先强制刷新，再判断是否为真实缺陷。
- 当前不再默认全量清理 Docker 数据；未来涉及生产或用户录入数据清理必须单独确认，不能随普通部署或普通验证自动执行。
- 现有数据库里如果已有旧等级值，例如 `3` 或 `3级`，页面会归一化显示为“三级/高级工”；新建和编辑会保存完整等级表述。

## 下一步建议

建议下一轮做 Phase 1.2 浏览器角色回归：

目标：用浏览器完整验证“意向考生 -> 转正式 -> 报名资料工作台 -> 导出/上传回填”的页面闭环。

建议任务：

1. 使用 `bjadmin/bjadmin123` 登录。
2. 在意向考生页面新增、编辑、重复手机号保存、删除一条测试记录。
3. 选择已发布计划，把一名意向考生转为正式考生。
4. 到报名资料工作台补齐 33 项资料和材料清单，设置缴费状态。
5. 审核通过后导出 `.xls`，抽查表头与数据。
6. 回填上传状态，在总部仪表盘确认可见。
7. 使用总部/系统管理员确认意向考生菜单不可见、缴费字段不可见。
8. 更新本文件记录验证结果。

## 对后续 AI 的硬性提醒

- 不要跳过这些 docs 直接改代码。
- 不要引入新数据库或重型架构。
- 不要绕过 `authenticate`、`requireRoles`、租户隔离、审计日志。
- 不要编辑 `src/backend/dist` 当作源码。
- 不要用固定假数字替代真实接口。
- 每次结束前更新本文件。
