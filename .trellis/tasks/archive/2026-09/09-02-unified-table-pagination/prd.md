# 统一表格组件与分页

## Goal

将管理端用于浏览、筛选和操作成组业务记录的页面统一为共享 Table 组件，并提供一致的上一页、下一页和指定页码跳转能力，避免各页面继续使用互不一致的卡片网格、伪表格和单向 cursor 链接。

## Background and confirmed facts

- 共享表格原语已经存在于 `packages/ui/src/components/table.tsx:5`，包含 Table、TableHeader、TableBody、TableRow、TableHead、TableCell 等语义化组件。
- 参与者列表已经使用共享 Table，但当前固定每页 25 条且只在存在 `nextCursor` 时显示“下一页”，没有上一页或页码跳转（`apps/admin-web/app/(console)/participants/page.tsx:22-90`）。
- 管理端任务列表使用 CSS Grid 模拟行列，Assignment 和 Review 列表使用卡片网格（`apps/admin-web/app/(console)/tasks/page.tsx:56-91`、`apps/admin-web/app/(console)/assignments/page.tsx:32-36`、`apps/admin-web/app/(console)/review/page.tsx:20-22`）。
- 采集记录的“视频记录”“录制会话”“操作记录”分别使用卡片网格或有序列表，并且都只有“下一页”（`apps/admin-web/app/(console)/records/video-records-panel.tsx:46-91`、`session-records-panel.tsx:26-42`、`activity-records-panel.tsx:30-44`）。
- 任务详情中的当前参与者已经使用共享 Table，但未分页；同页上传视频和操作记录仍是卡片或列表（`apps/admin-web/app/(console)/tasks/[taskPublicId]/task-participants-panel.tsx:73-87`、`task-uploads-panel.tsx:30-104`、`task-audit-panel.tsx:19-65`）。
- 管理端列表服务当前主要返回 `items + nextCursor`。任意页码跳转需要统一的页码参数、总数/总页数以及稳定排序，而不能只在现有 cursor 链上补一个按钮。
- 本次范围经产品确认固定为管理端顶级数据浏览：参与者、任务、Assignment、Review，以及采集记录的视频、录制会话和操作记录三个页签。
- Dashboard 指标/漏斗、上传详情 Metadata、任务详情子列表和参与者端移动卡片不属于本次范围。

## Requirements

- R1. 范围内的成组业务记录必须通过 `@egocapture/ui` 的共享 Table 组件渲染真实 table 语义，不再维护页面私有的伪表格行列结构。
- R2. 所有范围内的分页表格必须显示一致的分页栏，至少包含“上一页”“下一页”和可直接选择或输入目标页的页码跳转。
- R3. 分页状态必须通过 URL 查询参数表达，并在翻页时保留当前搜索、筛选和标签页；修改筛选条件后从第一页开始。
- R4. 服务端分页必须使用稳定排序，返回当前页、每页条数、总条数和总页数；越界或非法页码必须安全归一化或返回可恢复的第一页或末页状态。
- R5. 空状态、筛选无结果、加载后的操作入口、徽标、详情链接和管理员动作能力必须在表格化后保留。
- R6. 表格在窄屏下必须可横向滚动，不得压坏内容、遮挡操作或破坏键盘或屏幕阅读器语义。
- R7. 分页 UI、查询参数构造和分页结果类型必须复用，不允许每个页面复制一套按钮与 URL 拼装逻辑。
- R8. 必须保留当前工作区内其他任务或用户产生的未提交文件，不覆盖、不回退、不混入本任务提交。

## Acceptance Criteria

- [x] AC1. 范围清单中的每个数据集合都使用共享 Table 组件，并有明确的列标题、数据行、空状态和操作列。
- [x] AC2. 当总页数大于 1 时，用户能前往上一页、下一页和任意合法页码；第一页禁用上一页，末页禁用下一页。
- [x] AC3. 页码跳转与前后翻页保留搜索、筛选和 records 标签页，URL 可复制、刷新和浏览器前进或后退后复现同一视图。
- [x] AC4. 总条数不是每页条数的整数倍、结果为空、筛选后当前页越界、非法 page 参数等边界都有自动化覆盖。
- [x] AC5. 管理端列表服务和页面的 TypeScript、单元测试、生产构建通过；对主要表格页面完成浏览器级分页验收。
- [x] AC6. 现有详情链接、Review、Assignment、Session 操作、徽标含义和空状态文案保持可用。
- [x] AC7. 最终提交只包含本任务拥有的共享组件、范围内页面、必要服务或测试和 Trellis 任务文件。

## Out of Scope

- 数据库表结构或业务状态机变更。
- 新增排序、批量选择、列显隐、导出等未在本次请求中提出的数据表功能。
- Dashboard 指标或漏斗等非数据浏览页面。
- 上传详情中的固定键值 Metadata 表。
- 任务详情页内的参与者、上传和操作记录子列表。
- 参与者端以移动录制或上传为主的卡片页面。

## Key Decisions

- 任意页码跳转采用 URL `page` 参数和服务端总数统计，不继续以 cursor 历史链模拟页码。
- 参与者、任务和 Assignment 默认每页 25 条；Review 与采集记录页签默认每页 50 条。
- 顶级列表统一为真实 table 语义，窄屏通过横向滚动保留列与操作，不为本次范围另做移动卡片分支。
