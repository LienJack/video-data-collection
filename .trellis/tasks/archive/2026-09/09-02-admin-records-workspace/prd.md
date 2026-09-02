# 采集记录工作台交互重构

## Goal

将管理员端三个以领域实体命名的低频页面——录制会话、上传记录、审计日志——整合为一个以运营任务为中心的“采集记录”工作台。管理员进入页面后应先看到视频采集整体状态，再按需下钻到录制会话或操作记录；现有 Session、Upload、MatchDecision、ReviewCase、AuditEvent 的业务权威和不可变边界保持不变。

## Background and confirmed facts

- 当前侧边栏在“数据记录”折叠组中直接暴露 `/sessions`、`/uploads`、`/audit`，信息架构按数据库实体组织，而不是按管理员工作目标组织：`apps/admin-web/app/(console)/console-navigation.tsx:24-68`。
- `/sessions` 只有搜索、状态筛选和关闭开放 Session；Session 由参与者创建，管理员不负责创建：`apps/admin-web/app/(console)/sessions/page.tsx:14-28`。
- `/uploads` 列表只有筛选和进入详情；预览、Metadata 重试位于 `/uploads/[uploadPublicId]`：`apps/admin-web/app/(console)/uploads/page.tsx:12-24`、`apps/admin-web/app/(console)/uploads/[uploadPublicId]/upload-actions.tsx:9-35`。
- `/audit` 是追加写证据列表，数据库 Trigger 禁止 AuditEvent 更新和删除：`apps/admin-web/app/(console)/audit/page.tsx:9-23`、`database/migrations/0001_core.sql:484-486`。
- 任务详情已经提供上传视频和操作记录视图；全局工作台的价值应限定为跨任务查找和运营监控，而不是复制另一套任务详情：`apps/admin-web/app/(console)/tasks/[taskPublicId]/page.tsx:16-76`。
- 原始方向性需求要求管理员明确识别缺少上传、上传失败、重复、未匹配和人工复核项，并支持录制数小时或数天后的批量上传：`需求.md:22-26,42,46,60-66`。其中缺少上传属于 Assignment 状态，不能伪装成视频记录。
- 当前 Next.js 为 16.3.4。App Router `page.tsx` 的 `searchParams` 是 Promise，读取它会触发 request-time dynamic rendering；路由切换优先使用 `<Link>`，动态页面需要可见 loading 状态。

## User outcomes

1. 管理员从侧边栏只看到一个语义明确的“采集记录”入口。
2. 进入后默认看到视频记录及需要关注的状态，不需要理解 Session、UploadIntent 或 AuditEvent 等内部模型。
3. 管理员能在一次操作内进入视频详情、待处理事项或关闭开放会话。
4. 需要排障或追溯时，管理员能在同一工作台切换到录制会话和操作记录。
5. 旧链接在迁移期间仍可使用，上传详情链接不变。

## Requirements

### R1. Navigation and information architecture

- 用单一主导航入口“采集记录”替换“数据记录”折叠组及其三个子入口。
- “采集记录”与“总览、采集任务、参与者、待处理”处于同一层级。
- 移动端“全部功能”同步只显示一个“采集记录”入口。

### R2. Canonical workspace route

- 新增 `/records` 作为规范入口。
- 页签通过 URL 表达，允许刷新、复制链接、前进后退：
  - `/records?tab=videos`：视频记录，默认值。
  - `/records?tab=sessions`：录制会话。
  - `/records?tab=activity`：操作记录。
- 未知或缺失的 `tab` 安全回退到 `videos`，不得产生 500。
- 筛选和游标均保存在查询参数中；改变页签或筛选条件时清除旧游标。

### R3. Workspace summary and attention overview

- 页面顶部展示三个全局、未受当前页签筛选影响的指标：全部上传、传输处理中、未关闭会话。
- 单独展示异常概览：缺少上传、上传失败、Metadata 失败、重复候选、尚未匹配、设备不一致/需要人工处理。
- 缺少上传链接到现有 Assignment/Participant 缺失视图；其他异常进入带 `caseType` 的 `/review` 工作队列；“未关闭会话”进入 `sessions` 页签并应用 `status=open`。
- 每个指标必须使用准确、稳定的数据库口径，不能用当前分页长度冒充总数。

### R4. Video records tab

- 作为默认页签，展示 UploadIntent 到 VideoAsset/MatchDecision/ReviewCase 的运营投影。
- 每条记录至少显示文件名、参与者、任务或“任务待确定”、声明/最终 Session、文件大小、上传状态、Metadata 状态、匹配状态和待处理数量。
- 视频记录必须区分上传失败、Metadata 失败、重复候选和未匹配；缺少上传没有 UploadIntent，只在异常概览和任务/参与者进度中呈现。
- 主操作按状态确定：存在开放 ReviewCase 时为“处理异常”；否则为“查看视频详情”。
- 已验证且对象仍保留的视频，可从详情继续使用现有五分钟私有预览；Metadata 重试继续使用现有 API 和原因校验。
- 所有状态使用中文标签，并以文字和图标共同表达，不只依赖颜色。

### R5. Recording sessions tab

- 默认筛选 `open`，让页面承担“未关闭会话管理”而不是历史数据倾倒。
- 每条记录显示参与者、任务、设备、创建时间、Marker 确认状态和当前匹配视频数量。
- 提供“查看相关视频”；只为开放会话提供“关闭录制会话”。
- 关闭操作继续要求 10～500 字符原因，复用现有接口、确认交互和 AuditEvent 写入。
- 管理员可切换查看全部或已关闭历史；本次不新增“超时/异常”自动判定规则。
- 已关闭 Session 必须可搜索、可进入相关视频，用于数小时或数天后的批量上传和人工匹配追溯。

### R6. Activity tab

- 将“Audit Events”改写为“操作记录”，默认显示人类可读的中文时间线。
- 每条记录显示操作者、动作、对象、时间和原因；原始 action、request ID、before/after JSON 收入“查看变更详情”。
- 第一阶段支持关键词和动作分类；按操作者、任意时间范围等高级筛选延后。未识别 action 保留原值作为回退，不丢失证据。
- 页面只读，不提供修改或删除入口。

### R7. Context and duplication boundary

- `/records` 负责跨任务检索和全局运营；任务详情继续负责单任务内的参与者、视频和操作历史。
- 全局视频/Session 记录应链接回关联任务、参与者和上传详情。
- 中文状态与 Audit action 文案必须有单一前端映射来源，供全局工作台和任务详情复用。

### R8. Compatibility

- `/uploads` 临时跳转到 `/records?tab=videos`，并保留可映射的查询参数。
- `/sessions` 临时跳转到 `/records?tab=sessions`。
- `/audit` 临时跳转到 `/records?tab=activity`。
- `/uploads/[uploadPublicId]`、现有管理 API 和参与者端 `/uploads` 行为保持不变。
- 第一版使用可回滚的临时重定向；稳定后再单独决定是否改为永久重定向。

### R9. Responsive, accessible, and resilient states

- 320 px 宽度和 200% zoom 下不得产生页面级横向滚动或不可达操作。
- 页签采用真实链接和 `aria-current`，筛选采用原生 GET form；所有控件具有可见名称、键盘路径和 focus 状态。
- 桌面可使用表格或宽卡片；窄屏使用纵向卡片，信息顺序保持“对象 → 状态 → 上下文 → 操作”。
- Loading、初始空数据、筛选无结果和服务错误必须分别表达。
- 初始空状态说明数据如何产生并提供“查看采集任务”；筛选无结果提供“清除筛选”。

## Constraints

- 不改变 `Participant → Assignment → TaskVersion → Device → RecordingSession → UploadIntent/Attempt → VideoAsset → MatchDecision → ReviewCase/AuditEvent` 权威链。
- 不增加或修改数据库表、Migration、RLS、Storage、TUS、Metadata 解析和 Cron 行为。
- 不让管理员创建 Session，也不把 AuditEvent 变成可编辑记录。
- Server Component 直接调用现有服务层；Mutation 继续通过已有 Route Handler 完成。
- 保留当前共享 UI 组件、Phosphor 图标、Tailwind 4 和项目视觉 token。
- 工作区存在其他未提交修改时，实施和提交必须按本任务路径显式暂存，禁止使用 `git add -A`。

## Out of scope

- 二维码识别、视频自动分类或自动纠正匹配。
- 新的 Session 超时策略、后台自动关闭或通知系统。
- 视频播放组件、代理视频、抽帧、内容合规检查。
- 修改参与者端录制和上传流程。
- 重做 ReviewCase 决策工作台。
- 公网部署、云账号配置和生产多区域架构变更。
- 按操作者、任意时间范围等高级 AuditEvent 检索。

## Acceptance criteria

- [ ] AC1：桌面侧边栏和移动端功能菜单只显示一个“采集记录”入口，不再显示“数据记录”折叠组及三个子入口。（R1）
- [ ] AC2：访问 `/records`、缺失 `tab` 或非法 `tab` 均稳定展示视频记录；三个页签链接可复制、刷新和前进后退。（R2）
- [ ] AC3：顶部全局指标和异常概览来自独立聚合查询，明确显示缺少上传、上传失败、Metadata 失败、重复候选、尚未匹配和设备不一致，且不受当前分页/筛选影响。（R3）
- [ ] AC4：视频记录展示参与者、任务、声明/最终 Session 和四层状态；正常记录一跳进入详情，异常记录一跳进入对应 ReviewCase；缺少上传不被伪造为视频。（R4）
- [ ] AC5：录制会话默认显示开放会话，可切换并搜索全部/已关闭历史；关闭操作继续校验原因并产生 `session.closed` AuditEvent。（R5）
- [ ] AC6：操作记录默认使用中文动作和对象文案，技术字段折叠；过滤后游标仍稳定且未知 action 可见。（R6）
- [ ] AC7：全局工作台可进入关联任务、参与者和上传详情；共享状态文案不在多个页面重复定义。（R7）
- [ ] AC8：旧三个列表地址完成临时兼容跳转，`/uploads/[uploadPublicId]` 与参与者端 `/uploads` 不受影响。（R8）
- [ ] AC9：键盘可完成页签切换、筛选、查看详情和关闭会话；状态同时有图标与文字，错误说明恢复方式。（R9）
- [ ] AC10：Chromium 桌面和 320×760 视口通过记录工作台 E2E；页面级横向滚动宽度不超过视口。（R9）
- [ ] AC11：`pnpm lint`、`pnpm typecheck`、`pnpm test`、Admin production build 和现有完整 E2E 均通过。
- [ ] AC12：实现未新增数据库 Migration，未改变上传、审计不可变和参与者端 API 契约。
- [ ] AC13：验收报告明确说明本任务不构成公网部署或生产级跨区域、多 GB 上传证明。
