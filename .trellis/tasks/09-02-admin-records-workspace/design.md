# 采集记录工作台技术设计

## 1. Design summary

管理员端新增动态 Server Component 页面 `/records`，以 URL 页签承载视频、录制会话和操作记录三个跨任务投影。现有三个列表页降级为兼容重定向；上传详情、关闭 Session、私有预览、Metadata 重试和 ReviewCase 决策链保持原样。

核心原则：改变信息架构和只读查询投影，不改变领域权威。

```text
PostgreSQL authority
  ├─ recording_sessions
  ├─ upload_intents / video_assets / current_match_decisions
  └─ review_cases / audit_events
            │
            ▼
packages/core service projections
  ├─ getAdminRecordSummary
  ├─ listAdminUploads      (extended projection)
  ├─ listAdminSessions     (extended projection)
  └─ listAuditEvents       (extended filters)
            │
            ▼
Admin /records Server Component
  ├─ summary
  ├─ ?tab=videos
  ├─ ?tab=sessions
  └─ ?tab=activity
            │
            ▼
Existing mutations and detail routes
  ├─ /uploads/[uploadPublicId]
  ├─ /review/[casePublicId]
  └─ /api/admin/sessions/[sessionPublicId]/close
```

## 2. Scope boundary

### Changed

- 管理员导航和移动端功能菜单。
- 三个全局列表的入口、文案、筛选和投影字段。
- 服务层只读查询及一个汇总查询。
- 前端状态/action 中文呈现器。
- 旧列表路由的兼容行为。
- 新工作台 E2E 和纯函数/Schema 测试。

### Preserved

- 数据库表、RLS 和不可变 Trigger。
- Session 创建、Marker、关闭语义和 Audit 写入。
- UploadIntent/Attempt、TUS、对象对账、Metadata 提取。
- MatchDecision 和 ReviewCase 的决策权威。
- 上传详情和所有既有 Mutation API。
- 参与者站点的 `/uploads` 路由；两个站点继续隔离。

## 3. Target information architecture

侧边栏收敛为：

```text
总览
采集任务
参与者
待处理
采集记录
```

“采集记录”使用单一集合图标。选中 `/records` 时保持 active；管理员 `/uploads/[id]` 详情也将“采集记录”视为当前导航上下文。

工作台结构：

```text
采集记录
跨任务查看视频上传、录制会话和关键操作

[全部上传] [传输处理中] [未关闭会话]

异常概览：[缺少上传] [上传失败] [Metadata 失败]
          [重复候选] [尚未匹配] [设备不一致]

[视频记录] [录制会话] [操作记录]
[当前页签筛选区]
[当前页签结果]
[下一页]
```

缺少上传跳到 Assignment/Participant 缺失视图；其他异常跳到带 `caseType` 的 Review 队列。只有具备明确目的地的指标使用 `<Link>`；其他指标使用非交互容器，避免伪装成按钮。缺少上传没有 UploadIntent，禁止为了统一列表而创建或投影假的视频记录。

## 4. Route and query contract

### Canonical route

```ts
type RecordsTab = "videos" | "sessions" | "activity";

type SharedRecordsQuery = {
  tab?: RecordsTab;
  search?: string;
  cursor?: string;
};
```

页签是 URL 导航，不实现自定义 ARIA tab widget。使用 `<Link>` 和 `aria-current="page"`，天然支持新窗口、复制地址、刷新和浏览器历史。

各页签查询：

```ts
type VideoRecordsQuery = SharedRecordsQuery & {
  tab: "videos";
  transferStatus?: "created" | "uploading" | "reconciling" | "verified" | "failed" | "aborted" | "expired";
  metadataStatus?: "pending" | "processing" | "extracted" | "partial" | "unsupported" | "failed";
  attention?: "open";
};

type SessionRecordsQuery = SharedRecordsQuery & {
  tab: "sessions";
  status?: "open" | "closed" | "all";
};

type ActivityRecordsQuery = SharedRecordsQuery & {
  tab: "activity";
  category?: "task" | "participant" | "assignment" | "session" | "upload" | "metadata" | "review" | "system";
};
```

页面入口只解析一次查询参数。无效 `tab` 回退到 `videos`；无效枚举筛选被忽略并显示规范默认值，避免手工修改 URL 产生 500。字符串长度、日期合法性和 cursor 上限由 Zod 负责。

筛选使用 GET form，并带隐藏 `tab`。筛选提交不包含 `cursor`；“清除筛选”只保留当前 `tab`。

### Legacy redirects

旧页面保留为最小 Server Component，读取并转发兼容参数后调用 `redirect()`：

```text
/uploads?search=x       → /records?tab=videos&search=x
/sessions?status=open   → /records?tab=sessions&status=open
/audit?cursor=x         → /records?tab=activity&cursor=x
```

使用 307 临时重定向以便回滚；`/uploads/[uploadPublicId]` 不匹配该重定向。

## 5. Server rendering and data flow

`/records/page.tsx` 保持 Server Component 和 `dynamic = "force-dynamic"`。它在 `requireAdmin()` 后并行读取汇总和当前页签数据：

```ts
const viewer = await requireAdmin();
const query = parseRecordsQuery(await searchParams);

const [summary, result] = await Promise.all([
  getAdminRecordSummary(viewer),
  query.tab === "videos"
    ? listAdminUploads(viewer, toUploadQuery(query))
    : query.tab === "sessions"
      ? listAdminSessions(viewer, toSessionQuery(query))
      : listAuditEvents(viewer, toAuditQuery(query)),
]);
```

只查询当前页签，避免一次导航同时加载三个 50 行列表。汇总是一条独立聚合 SQL，不使用分页结果推算。

Client Component 边界保持最小：`SessionClose` 继续负责关闭会话，`UploadActions` 继续负责私有预览与 Metadata 重试；页签、筛选、分页和列表渲染不增加客户端全局状态。

## 6. Service projections

### 6.1 Summary

新增 `packages/core/src/server/services/records.ts`，用一条 SQL 返回：

```ts
type AdminRecordSummary = {
  totalUploads: number;
  transfersInProgress: number; // created, uploading, reconciling
  openSessions: number;
  attention: {
    missingUploads: number;
    uploadFailed: number;
    metadataFailed: number;
    duplicateCandidates: number;
    unmatched: number;
    deviceMismatch: number;
    needsReview: number;
  };
};
```

这是只读运营投影，不写入缓存表，也不成为新权威。

### 6.2 Upload projection

扩展 `listAdminUploads`，保留原字段并新增：

```ts
type AdminUploadRecord = {
  claimedSessionPublicId: string | null;
  resolvedSessionPublicId: string | null;
  taskPublicId: string | null;
  taskTitle: string | null;
  primaryReviewPublicId: string | null;
};
```

Session 呈现规则必须区分声明和最终决定：

1. 当前 MatchDecision 有 `resolvedSessionPublicId`：显示“已匹配”。
2. 无最终 Session 但有 `claimedSessionPublicId`：显示“参与者声明”。
3. 两者均无：显示“待确定”。
4. `decisionType = rejected` 时不得回退并伪装成已匹配的声明 Session。

`primaryReviewPublicId` 选择最新的 `open/in_review` ReviewCase，支持异常记录一跳进入处理页；`reviewCount` 保持全部开放事项数量。

缺少上传来自 Assignment/missing projection，没有 UploadIntent。它只进入异常概览以及既有任务/参与者进度视图，不进入 `AdminUploadRecord`。

### 6.3 Session projection

扩展 `listAdminSessions`：

```ts
type AdminSessionRecord = {
  taskPublicId: string;
  closedAt: Date | null;
  matchedVideoCount: number;
};
```

`matchedVideoCount` 只统计当前 MatchDecision 的 `resolved_session_id`，不把参与者声明但尚未确认的 UploadIntent 当成最终匹配。

### 6.4 Audit projection

扩展 `auditListSchema/listAuditEvents` 的第一阶段只读过滤：

- `search`：entity public ID、action、可见操作者名称。
- `category`：映射为受控 action 前缀集合，不把用户输入直接拼 SQL。
游标继续使用 `(created_at, id)` 降序。翻页必须携带相同筛选参数。

按操作者和任意时间范围筛选延后，避免为解决页面突兀而扩张查询面。

## 7. Presentation model

新增 `apps/admin-web/lib/record-presenters.ts`，集中维护：

- Transfer、Metadata、MatchDecision、Session 状态中文标签。
- Audit action 和 entity type 中文标签。
- 未识别状态/action 的安全回退。
- `recordHealth()`：只决定呈现优先级和主操作，不改变业务状态。

任务详情的 `task-uploads-panel.tsx` 和 `task-audit-panel.tsx` 改用同一呈现器，消除全局页与任务页文案漂移。业务判定仍来自服务返回的状态和开放 ReviewCase，不在组件中重建数据库规则。

## 8. Tab behavior

### Videos

字段顺序固定为“文件及参与者 → 任务和 Session → 四层状态 → 时间和大小 → 主操作”。主操作规则：

```text
primaryReviewPublicId != null → 处理异常 → /review/[id]
otherwise                    → 查看视频详情 → /uploads/[id]
```

预览和重试仍留在详情页，避免列表每行出现多个同权重按钮。

### Sessions

缺省 `status=open`。开放会话显示“查看相关视频”和“关闭录制会话”；已关闭会话显示相关视频和关闭时间。筛选区必须显式露出“全部历史”和“已关闭”，搜索覆盖已关闭 Session，以支持数小时或数天后的批量上传追溯。“查看相关视频”进入 `/records?tab=videos&search=<sessionPublicId>`，因此 Upload 搜索需覆盖声明/最终 Session public ID。

### Activity

时间线默认呈现中文摘要。技术字段放入原生 `<details>`，保留原始 action、entity type、request ID 和 before/after JSON。未知 action 使用原值回退，不丢证据。

## 9. Empty, loading, and error states

- `records/loading.tsx`：与汇总、页签和列表形状一致的 skeleton。
- Videos 初始空：说明参与者上传后会显示，操作为“查看采集任务”。
- Sessions open 空：说明当前没有未关闭会话，操作为“查看全部历史”。
- Activity 初始空：说明关键操作会自动记录，不提供伪造记录入口。
- 任一筛选空：显示当前筛选摘要和“清除筛选”。
- 服务错误：沿用现有 error boundary，信息必须说明重试方式。

## 10. Accessibility and responsive rules

- 链接表达导航、按钮表达动作、原生 form/select/details 表达筛选和披露。
- 页签和行操作至少 40 px 高；移动端沿用现有 `min-h-11/12`。
- 状态同时提供中文文字和图标；颜色只增强语义。
- 每页一个 `h1`，结果区域使用 `h2`；筛选控件有可见 `<label>`。
- 窄屏不通过横向滚动隐藏关键动作。
- 验证 320×760、390×844、桌面和 200% zoom；长文件名和 Public ID 可换行或在详情完整查看。

## 11. Authorization and security

- `/records` 位于现有 `(console)` 布局并调用 `requireAdmin()`。
- 服务层继续接收 `Viewer`，列表不暴露 service-role key 或对象 key。
- 私有预览继续由现有 Route Handler 生成五分钟 Signed URL。
- Activity 不增加原始视频 Metadata、GPS 坐标或 serial 暴露。
- 关闭 Session 继续通过 POST、原因校验、事务和 AuditEvent。

## 12. Performance

- 每次请求只加载一个结果页签和一个汇总查询。
- 列表限制 50 条并使用现有游标，禁止 offset pagination。
- 新关联字段通过一次 SQL join/subquery 投影，禁止组件循环 N+1。
- 用开发数据库检查查询计划；若需要新索引，暂停并单独提出 Migration，不在本任务暗中增加。

## 13. File impact

### Add

- `apps/admin-web/app/(console)/records/page.tsx`
- `apps/admin-web/app/(console)/records/loading.tsx`
- `apps/admin-web/app/(console)/records/video-records-panel.tsx`
- `apps/admin-web/app/(console)/records/session-records-panel.tsx`
- `apps/admin-web/app/(console)/records/activity-records-panel.tsx`
- `apps/admin-web/lib/record-presenters.ts`
- `packages/core/src/server/services/records.ts`
- `tests/e2e/records-workspace.spec.ts`
- 查询 Schema、呈现器和汇总投影所需的 focused tests。

### Modify

- `apps/admin-web/app/(console)/console-navigation.tsx`
- `apps/admin-web/app/(console)/sessions/page.tsx`
- `apps/admin-web/app/(console)/uploads/page.tsx`
- `apps/admin-web/app/(console)/audit/page.tsx`
- `apps/admin-web/app/(console)/tasks/[taskPublicId]/task-uploads-panel.tsx`
- `apps/admin-web/app/(console)/tasks/[taskPublicId]/task-audit-panel.tsx`
- `packages/core/src/server/services/sessions.ts`
- `packages/core/src/server/services/review.ts`

### Explicitly untouched

- `database/migrations/**`
- `apps/participant-web/**`
- TUS、Storage、Metadata Mutation 路径。
- 其他任务正在修改的文件。

## 14. Trade-offs

- **单一路由与 URL 页签**：统一用户心智，同时保留深链接；代价是页面需显式分派三类查询。
- **扩展现有列表服务**：保留一套分页契约，避免重复服务；代价是要回归现有消费者。
- **临时重定向**：优先保证可回滚；稳定后再决定永久 308。

## 15. Rollback

恢复旧导航和三个列表组件，删除 `/records` 与汇总服务即可。扩展的只读返回字段可保留，也可与测试一起恢复。由于没有 Migration、回填或权威状态写入，回滚不需要数据库操作。
