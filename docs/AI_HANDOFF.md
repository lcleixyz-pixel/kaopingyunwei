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

2026-05-11 生产验收测试：

- 已清理宿主机本地 SQLite `app/data/exam.db` 并重新执行 Prisma migration + seed；清理后为 3 个租户、5 个默认账号、0 条计划/考生/意向考生/证书/审计业务记录。
- 已执行 `EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml down -v` 清理 Docker 测试数据卷，并重新启动干净 Docker 环境。
- `npm run backend:test`：通过，58 个测试。
- `npm run check`：通过；前端 Vite 构建和后端 TypeScript 编译均通过。构建仍提示单个 JS chunk 超过 500 kB，属于性能优化项。
- `npm run lint`：通过。本轮为此修复了 `Dashboard` 的 React Compiler memo 依赖问题和 `Candidates` 的多余 `useMemo` 依赖。
- `npx prisma migrate status --schema src/backend/prisma/schema.prisma`：通过，9 个 migrations，schema 与数据库一致。
- `EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml config`：通过。
- `EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up --build -d`：通过，后端 healthy，前端引用最新 bundle `index-CWD74xdQ.js`。
- `GET http://localhost:8080/api/health`：通过，返回 `{"status":"ok","version":"1.0.0"}`。
- `API_BASE_URL=http://localhost:8080/api npm run phase1:smoke`：通过；脚本已更新为当前“申报条件”固定选项和材料闸门，覆盖计划、节点、考生、意向转正式、导出、上传回填、报名关闭、回退、取消和总部报表闭环。
- API 权限抽测：未登录 `/api/dashboard` 返回 401；总部访问 `/api/prospective-candidates` 返回 403；北京分部无法读取上海分部计划，详情返回 404。
- 浏览器验收 `http://localhost:8080`：系统管理员登录后打开仪表盘、考评计划、节点追踪、考生管理、成绩管理、证书管理、档案管理、AI 运维、系统设置，页面均非白屏，无框架错误层，过滤 `localhost:8080` 的 console error/warn 为空。
- 浏览器角色验收：`bjadmin/bjadmin123` 可见“意向考生”，默认“跟进中”，报名资料工作台显示“缴费”列；`hqadmin/hqadmin123` 不可见“意向考生”，访问该路由回到仪表盘，报名资料工作台不显示“缴费”列。
- 移动视口 390x844 抽测仪表盘：页面非白屏，无框架错误层，console error/warn 为空。
- Docker 构建期间 `npm audit` 提示 11 个依赖漏洞（3 moderate、8 high），生产上线前建议单独安排依赖安全治理。
- 本轮验收写入的 Docker 测试计划、意向考生和审计记录已在收尾阶段通过清理 Docker 数据卷移除；宿主机本地 SQLite 仍保持默认 seed 基线。

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

本轮 Phase 1.2 浏览器角色回归，执行于 2026-05-09：

- 本地应用 `http://localhost:8080/api/health`：通过，返回 `{"status":"ok","version":"1.0.0"}`。
- 使用分支管理员 `bjadmin/bjadmin123` 登录：通过；导航顺序仍为“仪表盘 -> 意向考生 -> 考评计划”，分支侧可见“意向考生”和报名资料工作台缴费列。
- 在“意向考生”页面新增测试记录：通过；测试记录为 `浏览器回归24062717`，手机号 `17124062717`，来源 `浏览器回归`。
- 将该意向考生转正式：通过；选择已发布且报名未截止计划 `789`，补证件号 `110101199001062717` 后转入报名资料工作台。转入后“跟进中”默认列表不再显示该意向考生。
- 在“报名资料工作台”选择计划 `789`：通过；可看到正式考生 `浏览器回归24062717`，初始状态为模板资料 `8项待补`、材料 `5项待补`、审核 `待审核`、缴费 `未缴`。
- 打开“资料”弹窗补齐模板字段和材料：通过；填入申报条件、文化程度、所在省（市）区、考生来源、所在单位、报名单位、民族、专业年限，勾选材料，并将缴费改为 `已缴`。保存后列表显示模板资料 `已齐全`、材料 `已齐全`、缴费 `已缴`。
- 点击“通过”审核：通过；列表显示审核 `已通过`。
- `.xls` 导出后端验证：通过；`GET /api/candidates/export?planId=4350d98e-0d93-4fff-b780-65c1d3bf5311` 返回 `200`，`content-type` 为 `application/vnd.ms-excel`，文件名为 `789-考生信息模板.xls`，大小 `5632` bytes。解析结果为 2 行，第 1 行是模板表头；第 2 行包含 `浏览器回归24062717`，工种 `玉石检验员`、等级 `三级/高级工`、手机号 `17124062717`、文化程度 `大学本科`、所在省 `北京市`、考生来源 `其它`、报名单位 `国家珠宝玉石首饰检验集团有限公司`、民族 `汉族`、专业年限 `10`。
- 上传回填后端验证：通过；由于当前浏览器层点击“上传回填”触发运行包中的 `window.prompt()`（见问题记录），改用 API 记录上传回填。`POST /api/exam-plans/4350d98e-0d93-4fff-b780-65c1d3bf5311/local-upload-batches` 返回 `201`，生成批次 `f0ca6646-65b9-49bc-a22c-787bee303d24`。计划 `789` 的“考试报名”节点已完成，`ROOM_ARRANGE` 节点进入 `IN_PROGRESS`，计划下拉显示 `789（报名已结束）`。
- 使用总部管理员 `hqadmin/hqadmin123` 登录验证：通过；侧边栏无“意向考生”菜单。进入报名资料工作台并选择 `789（报名已结束）` 后，表头为“姓名、计划、证件号码、模板资料、材料、审核、操作”，不显示“缴费”列；考生行不显示 `已缴` 或 `未缴`。
- 使用系统管理员 `admin/admin123` 登录验证：通过；侧边栏无“意向考生”菜单。进入报名资料工作台并选择 `789（报名已结束）` 后，表头和考生行同样不显示缴费字段。

本轮发现的问题：

- 当前 `localhost:8080` 运行中的前端包和源码疑似不一致：源码 `app/src/pages/Candidates.tsx` 中“上传回填”是弹窗式交互，但实际点击“上传回填”时浏览器 console 报 `Error: prompt() is not supported.`，说明运行包仍在调用 `window.prompt()`。这导致本轮无法用当前 in-app browser 直接完成页面上传回填，只能用 API 验证后端闭环。
- 当前 in-app browser 不支持下载事件，点击并等待“导出 .xls”会报 `Downloads are not supported by Codex In-app Browser.`。本轮改用已登录 API 下载并解析 `.xls` 内容完成导出验证；真实 Chrome 手工下载仍建议后续再补一次。

2026-05-09 后续环境设置结果：

- 已确认 `localhost:8080` 前端容器曾服务旧 bundle：HTML 引用 `index-B5o_nbWh.js`，而当前源码构建产物为 `index-BS1Wx72g.js`。
- 已无缓存重建前端镜像：`EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml build --no-cache frontend`，构建产物为 `dist/assets/index-BS1Wx72g.js`。
- 已只重启前端容器：`EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up -d frontend`；后端容器和 Docker 数据卷未重建，业务数据保留。
- 已确认 `curl http://localhost:8080` 现在引用 `./assets/index-BS1Wx72g.js`，旧 `index-B5o_nbWh.js` 在服务器侧返回 `404`，新 `index-BS1Wx72g.js` 返回 `200`。
- 由于浏览器对静态 JS 使用 immutable 缓存，Codex 内置浏览器仍可能持有旧包。为确保“最新源码前端”立即可用，已启动 Vite dev server：
  - 工作目录：`/Users/lc.leixyz/Desktop/kaopingyunwei-main/app`
  - 命令：`VITE_API_URL=http://localhost:8080/api npm run dev -- --host 0.0.0.0`
  - 前端地址：`http://localhost:3000`
  - API 地址：`http://localhost:8080/api`
- 已在 `http://localhost:3000/candidates` 使用 `bjadmin/bjadmin123` 验证最新源码前端：选择 `789（报名已结束）` 后点击“上传回填”，页面显示“地方系统上传回填”弹窗，包含备注框、“报名截止，结束考试报名阶段”、“还要添加考生，暂不截止报名”和“取消”按钮；过滤 `localhost:3000` 的 console error/warn 为空。

2026-05-09 成绩管理 500 修复记录：

- 现象：进入 `http://localhost:3000/scores` 成绩管理时前端报 `Request failed with status code 500`。
- 根因：页面实际请求的是 `GET /api/scores/plans`。本地源码 `app/src/backend/src/routes/scores.ts` 已包含 `router.get('/plans')`，但运行中的 `exam-backend` 容器是旧编译产物，容器内 `dist/routes/scores.js` 没有该路由；请求落到 Express SPA 回退，后端尝试读取容器内不存在的 `/app/dist/index.html`，因此返回 500。
- 修复动作：无缓存重建后端镜像并只替换后端容器，保留 Docker 数据卷：
  ```bash
  cd /Users/lc.leixyz/Desktop/kaopingyunwei-main/app
  EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml build --no-cache backend
  EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up -d backend
  ```
- 启动日志显示已应用 `20260509170000_score_recording_workflow` migration，seed 检测到已有数据并跳过初始化。
- 验证：
  - `GET http://localhost:8080/api/health`：通过。
  - `GET /api/scores/plans` 使用 `bjadmin/bjadmin123` token：返回 200，包含计划 `123 · 2026/05/30 · 贵金属首饰与宝玉石检测员 · 五级/初级工`。
  - 容器内 `/app/src/backend/dist/routes/scores.js` 已能 grep 到 `router.get('/plans'...)`。
  - 浏览器打开 `http://localhost:3000/scores`：成绩管理页加载正常，默认选中计划 `123`，显示统计卡片和手动检录表；页面无 `Request failed with status code 500`，过滤 `localhost:3000` 的 console error/warn 为空。

Codex 傻瓜式环境启动步骤：

1. 进入项目应用目录：
   ```bash
   cd /Users/lc.leixyz/Desktop/kaopingyunwei-main/app
   ```
2. 启动后端和生产静态前端容器（保留数据卷）：
   ```bash
   EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up -d backend frontend
   ```
3. 如果要确保 8080 静态前端也是最新源码，重建前端容器：
   ```bash
   EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml build --no-cache frontend
   EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up -d frontend
   ```
4. 日常 Codex 开发推荐跑源码前端，避免浏览器旧静态缓存：
   ```bash
   VITE_API_URL=http://localhost:8080/api npm run dev -- --host 0.0.0.0
   ```
5. 打开 `http://localhost:3000` 做浏览器回归；默认账号：
   - 分支管理员：`bjadmin / bjadmin123`
   - 总部管理员：`hqadmin / hqadmin123`
   - 系统管理员：`admin / admin123`
6. 健康检查：
   ```bash
   curl http://localhost:8080/api/health
   curl http://localhost:8080 | grep index-
   ```

本轮复现步骤：

1. 打开 `http://localhost:8080`，使用 `bjadmin/bjadmin123` 登录。
2. 进入“意向考生”，点击“新增意向考生”，填写姓名 `浏览器回归24062717`、手机号 `17124062717`、来源 `浏览器回归`，保存。
3. 在该行点击“转正式”，选择计划 `789`，填写证件号 `110101199001062717`，确认转正式。
4. 进入“考生管理/报名资料工作台”，选择计划 `789`，打开该考生“资料”，补齐必填模板字段、勾选材料、缴费改为 `已缴`，保存。
5. 在列表点击“通过”，确认审核状态变为 `已通过`。
6. 调用导出接口或用真实 Chrome 下载 `.xls`，抽查表头和 `浏览器回归24062717` 数据行。
7. 点击“上传回填”时若仍出现 `prompt() is not supported`，说明运行前端包未更新；可先重建前端镜像/刷新 bundle，再重试页面弹窗。后端可用 `POST /api/exam-plans/:id/local-upload-batches` 验证上传回填闭环。
8. 分别登录 `hqadmin/hqadmin123` 和 `admin/admin123`，确认侧边栏没有“意向考生”；进入报名资料工作台选择 `789（报名已结束）`，确认无“缴费”列且行内无缴费值。

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

2026-05-10 证书管理严格回归记录：

- 测试环境：Docker 运行包 `http://localhost:8080`，后端健康检查通过；浏览器使用真实 Chrome + Computer Use 操作，接口使用 8080 API。注意：宿主机 Prisma 会写入宿主本地 SQLite，8080 页面实际使用 Docker 容器内 `/app/data/exam.db`，本轮有效测试数据均重新写入 Docker DB。
- 本轮有效计划：`CERT-STRICT-1778360499890`，计划 ID `93009dca-b637-408e-853b-49616d2e17e1`，北京分部，4 名考生：2 名合格、1 名未录成绩、1 名不合格；仅 2 名合格考生进入证书编号回填表。
- 分支管理员 `bjadmin/bjadmin123` 浏览器验证：证书页能选择严格计划，显示“合格 2”；编号回填区有 `.xlsx` 选择文件、预览导入、提交回填、单行保存和“完成证书管理节点”按钮；未录成绩和不合格考生未出现在证书记录表。
- 总部管理员 `hqadmin/hqadmin123` 浏览器验证：侧边栏没有“意向考生”；证书编号回填区没有上传、保存、提交回填和完成节点按钮；申领与库存页显示跨机构库存、低库存提醒、审批/驳回、Word 和导出台账入口。
- 系统管理员 `admin/admin123` 浏览器验证：侧边栏没有“意向考生”；严格计划下两名合格考生和两个证书编号可见，但编号输入框为 disabled，行内无保存/标记打印按钮，也无上传/提交回填/完成节点按钮。
- 导入编号测试：
  - 有效 `.xlsx` 预览通过，提交后为 `严格回归合格甲9890` 写入 `CERT-STRICT-VALID-60499890`，来源为 `LOCAL_IMPORT`。
  - 未匹配、未合格、空编号均被预览标记为无效，提交含错误文件返回 400。
  - 文件内重复编号可在预览阶段识别，`duplicates = 1`。
  - 同计划另一名考生已占用的编号在预览阶段未被识别为重复，但提交阶段因唯一约束返回 400；这是需要优化的真实问题。
- 手工维护测试：对未合格考生直接创建证书记录返回 400，仅合格考生可维护证书编号。
- 申领/入库测试：分支提交空白证书和证书壳申领，总部审批并登记发出，分支确认入库后状态为 `RECEIVED`；库存流水出现 `SUPPLY_RECEIVED`，余额正确更新。严格流结束后北京分部余额为低库存状态，页面提示“库存低于50”，但不阻塞后续业务。
- 打印/发放测试：合格人数 2，领用空白证书 3 且不填超量原因时返回 400，`error.code = OVERRIDE_REASON_REQUIRED`；填写原因后允许保存并返回“本批领用数量原则上不超过合格人数的110%，超出需登记原因”警告，同时生成 `PRINT_USE` 库存流水。
- 作废/销毁测试：分支提交作废记录后状态为 `PENDING_DESTROY`；总部创建销毁批次并关闭后，销毁批次为 `CLOSED`，对应作废记录更新为 `DESTROYED`。
- 遗失补办测试：补办申请生成审核期限和补办期限；审核通过后可发放，费用字段、邮寄信息和最终 `ISSUED` 状态写入成功，并产生补办领用流水。
- 盘点提醒测试：创建季度盘点记录成功，账面数与实盘数一致，差异为 0；低库存提醒只提示、不硬拦截。
- 节点测试：分支完成 `CERT_MANAGE` 后，该节点变为 `COMPLETED`，下一节点 `COMPLETE` 进入 `IN_PROGRESS`；总部和系统管理员直接调用完成节点接口均返回 403。
- 导出产物：
  - 申领单：`/tmp/cert-strict-1778360886723/supply-request.doc`，HTTP 200，`application/msword; charset=utf-8`，内容标题为“空白证书/证书壳申领表”，包含北京分部、空白证书、数量、状态和备注。可用性结论：Word 兼容 HTML `.doc`，内容完整，但不是原生 `.docx`，后续若要满足制度附件排版建议改为真实 Word 模板导出。
  - 补办申请：`/tmp/cert-strict-1778360886723/reissue-request.doc`，HTTP 200，标题“职业技能等级证书补办申请表”，包含申请人、身份证号、原证书编号、费用、邮寄地址和状态。可用性结论同上。
  - 库存台账：`/tmp/cert-strict-1778360886723/ledger.xlsx`，HTTP 200，`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`，可被 `xlsx` 解析，工作表为“证书库存台账”，包含机构、物品类型、流水类型、数量、结余、关联对象、备注、时间等字段；本轮解析到 11 行记录，可用。
- 发现的问题和优化方向：
  - 编号导入预览没有识别“同一计划内其他考生已占用该证书编号”，直到提交阶段才失败。建议预览校验查询所有证书编号时只排除当前行对应考生自己的既有证书，而不是排除整个计划。
  - 未匹配导入行同时提示“未匹配到同计划内考生”和“仅合格考生可维护证书”，语义重复。建议未匹配时跳过合格性校验，只保留匹配失败原因。
  - Word 导出目前是 HTML-as-Word `.doc`。短期可打开和归档，长期建议使用真实 `.docx` 模板，以便总部制度表单页眉、签章区、分页和样式更稳定。
  - Chrome 扩展环境未开启 file URL 访问时，页面文件选择自动化受限；本轮 `.xlsx` 上传导入通过 API multipart 覆盖，后续真实验收建议再用人工文件选择或 Playwright 原生上传补测。
  - 证书节点完成接口当前主要校验角色和计划节点状态；业务上可考虑在“通过人数 = 已回填编号数”之外，再提示或阻断“未打印/未发放”即完成节点的情况，规则需业务确认。
  - 浏览器控制台在总部/系统登录仪表盘时仍出现 `GET /api/exam-nodes` 500。容器日志显示 Prisma `ExamNode.plan` required 但查到 orphan node，和证书页接口无关；建议清理孤儿节点并在节点查询里防御缺失计划。

本轮证书管理复现步骤：

1. 启动 Docker 运行包：`cd /Users/lc.leixyz/Desktop/kaopingyunwei-main/app && EXAM_PORT=8080 docker compose --env-file .env -f docker/docker-compose.yml up -d backend frontend`。
2. 在 Docker DB 中准备严格计划 `CERT-STRICT-1778360499890`：北京分部、2 名合格、1 名未成绩、1 名不合格，并为其中一名合格考生预置证书编号 `CERT-STRICT-EXIST-60499890`。
3. 用 `bjadmin/bjadmin123` 登录 `http://localhost:8080/certificates`，选择严格计划，确认只显示两名合格考生。
4. 分别导入有效、未匹配/未合格/空编号、文件内重复、同计划重复证书编号 `.xlsx`，记录预览和提交响应。
5. 分支提交空白证书和证书壳申领；切 `hqadmin/hqadmin123` 审批和登记发出；再用分支确认入库。
6. 用分支登记打印发放，先测试超 110% 无原因被拦截，再填写原因保存。
7. 用分支提交作废记录；切总部创建并关闭销毁批次。
8. 用分支提交遗失补办申请；切总部审核通过；用分支登记补办发放。
9. 创建季度盘点记录，确认低库存提醒仍不阻断业务。
10. 导出申领 Word、补办 Word、库存台账 Excel，并用文本/`xlsx` 解析抽查字段。
11. 用分支完成 `CERT_MANAGE` 节点；用总部和系统账号分别验证菜单、字段和接口权限不可办理分支专属动作。

2026-05-10 考生管理导出必填项修正：

- 问题：报名资料工作台的保存/实际填写要求和导出闸门不一致，导出要求过重。根因在 `candidateRegistration.ts` 的 `BASE_REQUIRED_FIELDS`：导出复用 `validateRegistrationGate()`，把 `所在单位`、`专业`、`专业年限`、`证书领取方式` 也作为硬性必填，导致资料可保存但导出被额外拦住。
- 修正：`所在单位`、`专业`、`专业年限`、`证书领取方式` 继续保留为 33 列模板字段和可填写字段，但不再阻断审核/导出。导出硬门槛保留为核心模板字段、固定选项合法、所需材料齐全、考生审核通过；当“是否有职业资格证书=是”时仍要求 `证书等级` 和 `证书编号`。
- 测试：更新 `candidateRegistration.test.ts`，明确这些背景/联系/领取类字段为空时仍通过导出闸门。
- 验证：
  - `npm run backend:test`：通过，45 个测试。
 - `npm run check`：通过，前端构建和后端 TypeScript 构建均成功；仅保留 Vite chunk size warning。

2026-05-10 证书管理文件与库存台账改造：

- 已落地范围：
  - 证书记录新增 `certDisplayIssueDate`（证书版面发证日期），手工保存和批量导入都必须填写；导入模板改为 4 列：姓名、证件号码、证书编号、证书版面发证日期。
  - 空白证书/证书壳申领改为“一单双数量”：空白证书数量、证书壳数量、责任人、联系人、电话、邮寄地址、备注；分支先生成固定 PDF 下载打印，盖章后上传 PDF/JPG/PNG 才正式提交。
  - 库存台账新增责任人、可用结余、待销毁数量；总部仍可全量查看，导出 Excel 支持责任人和双余额字段。
  - 打印记录新增实际打印数量和责任人；保存打印记录时校验“实际打印数量 = 空白证书领用 - 退回 - 作废”，并生成可打印的考生领取签字 PDF。
  - 打印作废会进入待销毁数量；手工作废会先扣减可用库存，再进入待销毁数量；总部关闭销毁批次后扣减待销毁数量。
  - 发放清单、盘点记录导出 Excel；销毁批次导出 PDF；附件支持按业务对象查询和下载。
  - 补办界面不再提供流程指南下载；补办保留申请书模板导出入口，新增责任人字段。当前补办发放仍使用 `REISSUE_USE` 库存流水扣减空白证书和证书壳。
- 数据库迁移：
  - 新增迁移 `20260510093000_certificate_files_stock_responsibility`，已在本地 `app/data/exam.db` 执行 `npx prisma migrate deploy --schema src/backend/prisma/schema.prisma` 成功。
  - 注意：上一轮 `20260509181302_certificate_management_flow` 在本地库中已应用，本轮新增字段不能只靠修改旧迁移，必须保留新增迁移。
- 自动化验证：
  - `npm run backend:test`：通过，49 个测试。
  - `npm run check`：通过，前端构建和后端 TypeScript 构建均成功；仍有 Vite chunk size warning。
- HTTP 抽测结果（本地后端 `PORT=3101 npm run backend:dev`）：
  - `GET /api/certificates/exports/certificate-import-template.xlsx`：HTTP 200，Excel 可解析，含 4 列导入模板。
  - `GET /api/certificates/exports/supply-request-template.pdf?...`：HTTP 200，`application/pdf`，文件头 `%PDF-`，大小约 29KB。
  - 分支 `bjadmin/bjadmin123` 上传盖章 PDF 创建申领单 `2cdcc63a-7b92-4c9a-b5bf-5e872b450c5f`；总部 `hqadmin/hqadmin123` 审批、发出；分支确认入库均 HTTP 200/201。
  - 入库后库存台账出现 `SUPPLY_RECEIVED`：空白证书 +2、证书壳 +1，责任人为“测试责任人”，可用结余和待销毁数量字段返回正常。
  - `GET /api/certificates/exports/ledger.xlsx`：HTTP 200，工作表“证书库存台账”，字段含机构、物品、流水类型、数量、可用结余、待销毁、责任人、操作人、关联对象、备注、时间。
  - `GET /api/certificates/exports/delivery.xlsx` 和 `/exports/stocktakes.xlsx`：HTTP 200；当前本地数据为空表时仍可生成可打开的 Excel。
  - 使用计划 `e6181993-4919-427e-a32b-8f5eb25991a7`、考生 `8f252da8-72e2-4541-ab3b-d547ec6d9b46` 手工写入证书编号 `CERT-PRINT-TEST-0510` 和版面发证日期 `2026-05-10` 成功。
  - 创建打印记录 `62a14dc4-0f6f-4db1-b9c1-e2c0bc13be91` 成功，实际打印数量 1；`GET /api/certificates/exports/print-record/{id}/signature.pdf` HTTP 200，文件头 `%PDF-`，大小约 36KB。
- 发现的问题和优化方向：
  - PDF 生成依赖本机中文字体。当前优先使用 `/System/Library/Fonts/Supplemental/Arial Unicode.ttf`，Mac 本地可用；Docker/Linux 部署时需确认镜像内有 Noto CJK 或文泉驿字体，否则中文 PDF 可能失败或乱码。
  - 补办“走同一套打印领用/结算库存流程”当前仍是较轻实现：发放时直接生成 `REISSUE_USE` 库存流水，没有强制关联打印批次和领取签字表。若业务要求完全同打印批次一致，下一轮需要给补办申请增加“创建补办打印批次/结算/签字表”入口。
  - 证书状态“发放”现在要求记录处于 `PRINTED` 且有 `printedAt`，但未按实际打印批次数量逐条锁定发放上限。后续可按打印批次的实际打印证书列表做更精细校验。
  - 本轮 HTTP 抽测写入了本地测试申领、入库和打印记录；如需要干净演示数据，后续可重新 seed 或单独清理这些测试记录。

2026-05-10 当前源码证书管理 Chrome/API 严格回归：

- 测试环境：
  - 后端：`PORT=3101 npm run backend:dev`。
  - 前端：`VITE_API_URL=http://127.0.0.1:3101/api npm run dev -- --host 127.0.0.1 --port 3000`。
  - Chrome 地址：`http://127.0.0.1:3000/certificates`。
  - 已先执行 `npx prisma migrate deploy --schema src/backend/prisma/schema.prisma`，确认本地 `app/data/exam.db` 已应用最新迁移。
- 本轮测试数据：
  - 严格计划：`CERT-BROWSER-15125482`，计划 ID `e35c76a9-b64f-4658-88d0-c4450143ef9b`。
  - 考生：2 名合格、1 名不合格；不合格考生直接维护证书编号返回 400。
  - 本轮脚本会额外留下若干 `CERT-BROWSER-*` 严格测试计划和库存流水，属于验证数据。
- Chrome 页面验证：
  - 分支管理员 `bjadmin/bjadmin123`：证书页可进入；计划工作台显示导入模板、文件选择、预览导入、提交回填、单行保存、完成证书管理节点；申领与库存页显示分支填写表单、生成 PDF、上传提交、库存余额、待销毁和低库存提醒。
  - 总部管理员 `hqadmin/hqadmin123`：侧边栏没有“意向考生”；证书编号回填区没有上传/保存/提交/完成节点按钮；申领与库存页可看全量库存和台账，但分支申领填写表单隐藏，仅保留审批监管和 PDF/台账查看入口。
  - 系统管理员 `admin/admin123`：侧边栏没有“意向考生”；通过接口确认 `/candidates` 响应不包含 `paymentStatus`，和总部一致。
- 严格 API 回归结果：
  - 导入模板 Excel 字段通过：姓名、证件号码、证书编号、证书版面发证日期。
  - 固定申领 PDF 通过：文件头 `%PDF-`，约 29KB。
  - 申领未上传盖章件返回 400；总部直接提交分支申领返回 403。
  - 分支提交盖章 PDF -> 总部审批 -> 总部发出 -> 分支入库闭环通过，入库单 `0568de8f-f7b8-4976-ace1-9e8aabb967b9`。
  - 错误导入预览通过：4 行中 3 行无效，包含未匹配、日期错误、文件内重复编号；含错误行提交返回 400。
  - 合法编号导入提交成功，写入 2 条证书编号。
  - 不合格考生建证书记录返回 400；重复使用已占用证书编号返回 400。
  - 打印领用超 110% 且无原因返回 400；总部直接创建打印记录返回 403；填写超量原因后保存打印记录成功。
  - 领取签字表 PDF 通过：文件头 `%PDF-`，约 34KB。
  - 发放清单 Excel 可解析，字段通过：姓名、证件类型、证件号码、职业、职业工种名称、认定等级、证书编号、发证日期、实际发放时间、领取方式、领取人、联系电话、邮寄地址、快递单号、备注。
  - 作废记录 -> 总部销毁批次 -> 销毁登记 PDF -> 关闭批次通过，销毁批次 `d0aa8834-0d65-457e-ae5e-58e85fdac491`。
  - 盘点责任人为空返回 400；填写责任人后盘点保存成功。
  - 库存台账 Excel 可解析，字段通过：机构、物品、流水类型、数量、可用结余、待销毁、责任人、操作人、关联对象、备注、时间。
  - 盘点 Excel 可解析，字段通过：机构、物品、盘点类型、账面数量、实盘数量、差异、责任人、操作人、备注、时间。
  - 分支库存接口只返回本机构；总部库存接口返回跨机构数据。
  - `/prospective-candidates` 对总部和系统管理员均返回 403。
- 本轮发现并已修正的问题：
  - 发放清单导出列名原为“证书版面发证日期”，与此前确立的统一打印/发放格式“发证日期”不一致；已改为“发证日期”，内部字段仍保留 `certDisplayIssueDate`。
  - 库存台账导出列名原为“分支机构/物品类型/待销毁数量”，与页面“机构/物品/待销毁”不一致；已统一为“机构/物品/待销毁”。
  - 盘点导出列名原为“分支机构/物品类型”，与页面不一致；已统一为“机构/物品”。
- 本轮验证命令：
  - `npm run backend:test`：通过，49 个测试。
  - `npm run check`：通过，前端构建、Prisma generate、后端 TypeScript 构建均成功；仅保留 Vite chunk size warning。
- 仍需关注的优化：
  - Chrome/Computer Use 无法稳定自动化真实文件选择器，本轮上传导入和盖章件上传用 API multipart 覆盖；需要人工或 Playwright 原生 file chooser 再补一次纯 UI 文件选择验证。
  - 补办当前仍是 `REISSUE_USE` 直接扣库存，没有完全复用打印批次/结算/领取签字表。
  - 证书发放当前通过记录状态控制，尚未按打印批次实际打印名单做逐条发放上限绑定。
  - 严格测试多次写入 `CERT-BROWSER-*` 数据，如演示环境需要清爽列表，可后续单独清理这些测试计划和关联库存流水。

未完成验证：

- 尚未用浏览器逐项点击验证意向考生编辑、重复手机号确认和删除；API smoke 已覆盖这些行为。
- 尚未在真实 Chrome 下载目录中手工确认 `.xls` 下载落盘；本轮已通过 API 下载并解析文件内容。
- 尚未在运行前端包修复/重建后重新点击验证上传回填弹窗；本轮页面点击暴露 `window.prompt()` 运行包问题，后端闭环已用 API 验证。
- 尚未完整走一条“计划 -> 节点 -> 考生 -> 成绩 -> 证书 -> 档案”的写入型 happy path。
- 尚未用多个角色逐项验证所有模块的页面权限和 API 权限；本轮已覆盖证书管理、意向考生入口和缴费字段隐藏。
- 尚未用浏览器验证北京分部与上海分部之间的数据隔离。

## 已知风险

2026-05-11 档案管理证书上报批次实现与验证：

- 本轮实现：
  - 档案管理新增“证书上报批次”工作台，保留旧版封存档案入口。
  - 新增 Prisma 模型 `ArchiveReportBatch`、`ArchiveReportBatchPlan` 和状态 `DRAFT/SUBMITTED/APPROVED/REJECTED`。
  - 新增迁移 `20260511113000_archive_report_batches`，已对本地 `app/data/exam.db` 执行 `npx prisma migrate deploy --schema src/backend/prisma/schema.prisma` 成功。
  - 新增后端接口：`/api/archives/reportable-plans`、`/api/archives/batches`、`/table5.pdf`、`/data.xlsx`、`/signed-file`、`/submit`、`/review`。
  - 分支可多选同机构、已进入证书管理节点且存在完整证书记录的计划创建批次；总部可跨机构查看、下载、审批；总部普通人员只读。
  - 提交时上传签字盖章件，系统冻结总部上报数据表快照和表5汇总快照。
  - 表5 PDF 按真实样例固定版式生成，保留签字、单位盖章和日期区域；数据表 Excel 字段固定为 11 列：姓名、证件类型、证件号码、所在单位、职业名称、工种名称、职业技能等级、证书编号、发证日期、评价机构、发证机构。
- 本轮测试数据：
  - 分支账号：`bjadmin/bjadmin123`；总部账号：`hqadmin/hqadmin123`。
  - 创建测试批次：`TESTARCHIVE2026051101`，批次 ID `8b77651c-5b08-46dd-9a52-94182cccd58c`。
  - 选择计划：`CERT-BROWSER-15125482`，完整证书记录 2 条。
  - 上传测试盖章件使用系统生成的 `/tmp/archive-table5.pdf`。
- 验证结果：
  - 浏览器打开 `http://127.0.0.1:3000/archives`，分支角色可见待报备提醒、待上报计划、批次表单；完整记录为 0 的计划不可勾选。
  - 分支创建批次成功，选中计划变为“已在批次”，批次列表显示草稿、表5 PDF、数据表、编辑和上传提交入口。
  - `GET /api/archives/batches/{id}/table5.pdf` 返回有效 PDF，文件头 `%PDF-`，大小约 38KB；已渲染检查，表格、汇总、签字盖章区可用。
  - `GET /api/archives/batches/{id}/data.xlsx` 返回有效 Excel，工作表 `Sheet1`，2 行数据，11 个表头与计划一致；证件类型为 `201`，缺失所在单位回填 `其他`，等级导出为 `3`，发证日期来自证书版面发证日期。
  - 分支上传盖章件提交后状态变为 `SUBMITTED`，生成数据表快照大小 17970 字节并记录 SHA-256。
  - 总部账号可见该批次和盖章件，不显示分支“待上报计划/创建批次”表单；审批通过后状态变为 `APPROVED`，页面显示“总部已通过”和审核意见“测试通过”。
  - `npm run backend:test`：通过，58 个测试。
  - `npm run backend:build`：通过。
  - `npm run build`：通过；仍有 Vite chunk size warning。
- 发现的问题和优化方向：
  - 表5 PDF 当前最多直接展示 2 个职业/工种/等级汇总行，超过 2 行会在底部提示完整明细以数据表为准。若总部要求表5必须完整展开多行，需要改为动态分页表5。
  - 当前数据类型 v1 固定为“新增”；如果后续出现更正、补录等上报类型，需要在批次表单和导出中开放枚举。
  - 盖章件上传已用 API multipart 覆盖并在页面呈现，尚未用真实浏览器文件选择器手工点选上传；需要人工回归一次文件选择体验。
  - 测试批次已留在本地库且状态为总部已通过；如演示需要干净数据，可后续按批次号清理。

- 当前项目目录没有检测到 Git 元数据，无法依靠 `git status` 做变更保护。修改前后需要用文件清单和人工说明控制范围。
- README 中仍有部分描述偏理想化，例如 AI 运维“自然语言交互”，实际 MVP 当前是规则化运维面板。
- Docker 构建时 npm audit 提示依赖存在漏洞，需要后续专项评估，不能直接盲目 `npm audit fix`。
- Docker 首次构建曾因网络 `ECONNRESET` 在 Prisma engines 下载阶段失败；重试后通过，判断为环境网络波动。
- 成绩、证书、档案已具备基础能力，但还需要按真实业务补字段、批量导入、打印模板、调阅记录等细节。
- 权限矩阵需要业务方确认后再精细化。
- 模板必填项根据模板说明和当前业务规则固化在代码中；原 `.xls` 的红色必填样式未被程序直接读取。若后续获得更明确官方说明，需要同步更新 `candidateRegistration.ts` 的必填字段列表和测试。
- Chrome 浏览器可能缓存旧前端 bundle；页面异常时先强制刷新，再判断是否为真实缺陷。
- 当前 `localhost:8080` 运行包疑似仍含旧版上传回填 `window.prompt()` 逻辑；源码已经是弹窗式上传回填。若继续页面回归，建议先重建前端镜像并强制刷新，确认运行包与源码一致。
- 前后端容器都可能因为长时间运行而落后于源码；如果看到“源码里有、页面/API 没有”的行为，先用 `docker exec exam-backend grep ... /app/src/backend/dist` 或 `curl http://localhost:8080 | grep index-` 确认运行产物，再重建对应容器。
- Codex in-app browser 不支持下载事件；`.xls` 下载类验证可用真实 Chrome 手工下载，或用 API 下载后解析文件内容。
- 当前不再默认全量清理 Docker 数据；未来涉及生产或用户录入数据清理必须单独确认，不能随普通部署或普通验证自动执行。
- 现有数据库里如果已有旧等级值，例如 `3` 或 `3级`，页面会归一化显示为“三级/高级工”；新建和编辑会保存完整等级表述。

## 下一步建议

建议下一轮优先处理本轮浏览器回归发现：

目标：让运行包与源码一致，并补齐剩余真实浏览器下载/上传回填验证。

建议任务：

1. 重建/重启前端容器或确认 `localhost:8080/assets/*` 对应当前 `Candidates.tsx` 弹窗式上传回填代码。
2. 使用真实 Chrome 或重建后的页面重试“上传回填”，确认不再触发 `window.prompt()`，并能在页面选择“报名截止，结束考试报名阶段”。
3. 使用真实 Chrome 手工下载 `.xls` 到下载目录，再抽查文件能用 Excel/WPS 打开。
4. 补测意向考生编辑、重复手机号确认、删除。
5. 补测北京分部与上海分部之间的数据隔离。
6. 更新本文件记录验证结果。

## 对后续 AI 的硬性提醒

- 不要跳过这些 docs 直接改代码。
- 不要引入新数据库或重型架构。
- 不要绕过 `authenticate`、`requireRoles`、租户隔离、审计日志。
- 不要编辑 `src/backend/dist` 当作源码。
- 不要用固定假数字替代真实接口。
- 每次结束前更新本文件。
