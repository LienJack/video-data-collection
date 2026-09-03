# 统一表格组件与分页技术设计

## Scope inventory

本次只处理管理端顶级数据浏览集合：

1. `/participants`
2. `/tasks`
3. `/assignments`
4. `/review`
5. `/records?tab=videos`
6. `/records?tab=sessions`
7. `/records?tab=activity`

Dashboard、详情页子列表、上传 Metadata 和 participant-web 卡片不变。

## Pagination contract

管理端顶级列表从 cursor URL 迁移到页码合同：

```ts
type PageInput = {
  page: number;      // 1-based, default 1
  pageSize: number;  // service/schema bounded
};

type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number; // empty result also reports 1 for a stable UI state
};
```

在 core 提供共享页码 schema/类型和 `resolvePage(totalItems, requestedPage, pageSize)`：非法、负数、小数或数组形式的 URL page 在页面解析层回落到 1；大于末页的 page 在服务层归一化到末页。服务先执行带相同筛选条件的 count，再以归一化后的 offset 查询当前页。

默认页容量：participants/tasks/assignments=25，review/records=50。页面固定容量，不在本次增加用户可调 page size 控件；API 结果仍返回 pageSize。

## Ordering and query behavior

- Participants、Tasks、Assignments：保持 `public_id asc`。
- Review、Videos、Sessions：保持 `created_at desc, public_id desc`。
- Activity：保持 `created_at desc, id desc`。

每个排序都有唯一 tie-breaker，避免同时间记录跨页重复或遗漏。筛选条件在 count 与 items 查询中必须完全一致。任意页跳转使用 OFFSET，是满足小规模管理端任意页访问的最小机制；如果未来记录规模要求深分页，再单独设计 cursor/seek 与页码索引映射。

## URL and UI composition

新增 admin-web 共享 `TablePagination` Server Component 和纯查询参数 helper：

- 输入 pathname、当前有效 query、PageResult metadata。
- 上一页/下一页使用 Next Link；第一页/末页提供不可操作且有 aria-disabled 语义的状态。
- 数字 input 的 GET form 可跳转任意页，保留除 `page` 外的搜索、筛选和 records `tab` 参数。
- 筛选 form 不携带 page，因此提交新筛选自动回到第 1 页。
- 页面链接使用统一 helper 构建，不在七个集合复制 URL 拼装。
- `totalPages <= 1` 时仍可显示“共 N 条 / 第 1 页”，但不显示多余跳转动作。

Records 的 `RecordsQuery` 将 `cursor` 替换为 `page`；切换 tab 默认回到第 1 页，页内筛选和翻页保留当前 tab。

## Table conversion

所有范围内集合用 `@egocapture/ui/components/table` 的 Table、Header、Body、Row、Head、Cell。外层使用横向滚动容器和每个表格的合理 min-width。

- Tasks：任务、状态、参与者、完成、视频、待处理、最近截止、操作。
- Assignments：Assignment、任务版本、参与者、截止、状态/信号、操作。
- Review：Case、类型、参与者、关联对象、原因、状态、操作。
- Videos：文件、参与者、任务/Session、传输/Metadata/匹配/Review、大小/时间、操作。
- Sessions：Session、参与者、任务/设备、状态、Marker/视频、创建时间、操作。
- Activity：动作、实体、操作者、原因/变化摘要、时间。
- Participants 保留现有列并为后续 drawer 子任务预留明确操作列。

表格化必须保留原详情链接、Badge 含义、AssignmentActions、SessionClose、Review 入口、空状态与筛选清除动作。不能把整行包装为 Link，因为行内可能包含其他按钮；主标识或操作列提供明确链接。

## Service/API compatibility

- 管理端列表 route 接受 `page`/`pageSize`，不再生成 cursor 链接。
- `dashboardSummary` 对 `listAuditEvents` 的 8 条预览改为 `{ page: 1, pageSize: 8 }`，保持摘要行为。
- 本仓库内所有调用方与 route 在同一 commit 更新，避免合同短暂不一致。
- cursor 编码工具仍被其他非本范围流程使用时保留；只有确认无消费者后才删除死代码。

## Verification strategy

- 纯函数单元测试：空集、非整除、末页、越界、非法 page、查询参数保留。
- 服务/集成检查：每种筛选的 totalItems 与 items 一致，排序稳定，末页正确。
- 组件/浏览器：上一页/下一页/指定页、刷新、复制 URL、浏览器前进后退、筛选重置 page。
- 七个集合的表头、空状态、主动作和窄屏横向滚动回归。

## Rollback

分页服务合同、页面调用和 Table 转换放入同一 scoped commit。回退该 commit 可整体恢复 cursor 页面。分页改造不需要数据库 Migration。
