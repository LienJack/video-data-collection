# 统一表格组件与分页实施计划

## 1. Preflight

- [x] 读取 root/admin-web AGENTS 与 Next.js 16.3.4 的 searchParams、Link、form 和 Server Component 指南。
- [x] 记录工作树与相关页面基线；排除 drawer、凭据、任务详情动作、bootstrap guidelines 和 `需求.md`。
- [x] 运行现有 records query/unit tests，记录改动前结果。

## 2. Shared pagination foundation

- [x] 在 core 增加 page input/result 类型、schema 和页码归一化 helper。
- [x] 在 admin-web 增加共享 URL helper 与 `TablePagination`，支持 prev/next、数字页跳转、总数和 aria 状态。
- [x] 为非法 page、空集、非整除、越界和参数保留添加单元测试。

完成标准：页面无需复制 URL 拼装即可构建可刷新、可前进后退的分页链接。

## 3. Service contract migration

- [x] 迁移 `listParticipants`、`listTasks`、`listAssignments`。
- [x] 迁移 `listReviewCases`、`listAdminUploads`、`listAuditEvents`、`listAdminSessions`。
- [x] 每个服务复用 PageResult 元数据，count/items 筛选一致，稳定排序包含唯一 tie-breaker。
- [x] 更新 admin API routes、records query parser 和 dashboard audit preview 调用。

完成标准：七个集合返回 `items/page/pageSize/totalItems/totalPages`，越界页返回归一化末页。

## 4. Page and table migration

- [x] Participants 接入共享 Pagination，保留现有 Table，并增加空的/可扩展操作列落点供 drawer 子任务使用。
- [x] Tasks 从 CSS Grid 迁移到共享 Table。
- [x] Assignments、Review 从卡片迁移到共享 Table。
- [x] Records videos、sessions、activity 从卡片/列表迁移到共享 Table。
- [x] 所有表格加横向滚动边界、语义表头、空状态和操作列；保留链接、Badge、AssignmentActions、SessionClose 与 Review 行为。
- [x] 所有筛选 form 省略 page，所有分页链接保留当前筛选和 tab。

完成标准：范围清单七个集合均使用真实 table 语义和同一分页栏。

## 5. Verification

- [x] `pnpm test -- records-workspace pagination`（按最终测试文件名调整）。
- [x] `pnpm participant:test`、`pnpm task:test`、`pnpm review:test`。
- [x] `pnpm typecheck`。
- [x] `pnpm --filter @egocapture/admin-web build`。
- [x] Playwright 验证 participants/tasks/assignments/review/records 的 URL 翻页、任意页、筛选重置、返回前进和窄屏滚动。
- [x] 对 count/items 边界增加至少一组超过单页容量的受控测试数据并清理该测试拥有的数据。

## 6. Review and commit

- [x] Trellis check 子代理复核分页正确性、筛选一致性、语义表格、操作保留和性能风险。
- [x] `git diff --check`；显式暂存分页 core/helper、范围内页面、测试与本子任务 Trellis 文件。
- [ ] 确认 staged diff 不含凭据、drawer、任务详情动作、bootstrap guidelines 或 `需求.md`。
- [x] 创建一个分页子任务 scoped commit，并记录 commit SHA 后归档子任务。
