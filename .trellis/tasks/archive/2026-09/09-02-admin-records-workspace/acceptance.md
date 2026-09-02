# 采集记录工作台验收记录

日期：2026-09-02

## 结果

本任务已完成管理员端“采集记录”工作台的本地实现与聚焦验收。它将原先独立的上传记录、录制会话和审计日志入口收敛到 `/records`，保留原有 Upload、Session、MatchDecision、ReviewCase 和 AuditEvent 权威边界。

## Acceptance criteria evidence

| AC | 结果 | 证据 |
| --- | --- | --- |
| AC1 | PASS | `console-navigation.tsx` 只保留一个“采集记录”入口；`records-workspace.spec.ts` 从主导航进入工作台。 |
| AC2 | PASS | `records-query.ts` 统一归一化三个 URL 页签、非法值和游标；单元测试覆盖默认与非法查询；浏览器覆盖 URL 导航。 |
| AC3 | PASS | `records.ts` 用独立聚合查询返回三个全局指标和七类异常；浏览器验证缺少上传与上传失败的目的地。 |
| AC4 | PASS | 视频卡片展示参与者、任务、声明/最终 Session、传输、Metadata、匹配和复核状态；开放 ReviewCase 一跳进入处理页；缺少上传不进入视频列表。 |
| AC5 | PASS | Session 默认 `open`，支持 `closed/all` 和历史搜索；复用 `SessionClose` 并验证原因长度。 |
| AC6 | PASS | Activity 使用共享中文 action/entity 映射、关键词/分类筛选和稳定游标；原始 action、request ID、before/after JSON 可展开，未知值原样回退。 |
| AC7 | PASS | 全局记录链接回任务、参与者、上传详情和 ReviewCase；任务上传与操作记录面板改用共享 presenter。 |
| AC8 | PASS | `/uploads`、`/sessions`、`/audit` 使用 307 临时重定向并保留兼容筛选；浏览器验证 `/uploads/[id]` 不重定向。 |
| AC9 | PASS | 页签、筛选、清除筛选、主操作和关闭入口均可走键盘路径；状态同时使用图标和文字。 |
| AC10 | PASS | Chromium 在桌面与 320×760 视口通过，页面级 `scrollWidth <= clientWidth`；320 CSS px 的窄视口同时覆盖常见桌面宽度在 200% 缩放后的布局约束。 |
| AC11 | PARTIAL | `pnpm check` 全部通过；聚焦 Chromium 6/6 通过。完整 E2E 为 13 passed / 1 skipped / 1 failed，唯一失败是既有 `main-flow.spec.ts` 在本任务路径之前等待“发布新版本”超时。 |
| AC12 | PASS | diff 不包含 `database/migrations/**`、`apps/participant-web/**` 或上传/审计 Mutation 契约变更。 |
| AC13 | PASS | 本记录明确声明本任务不证明公网部署、Vercel/Supabase 云验收、生产级多 GB 或跨区域上传能力。 |

## Validation evidence

通过：

- `pnpm check`：lint、typecheck、55 项单元测试、Participant/Admin production build 全部通过。
- `pnpm exec vitest run tests/unit/records-workspace.test.ts`：7/7 通过。
- `pnpm exec playwright test tests/e2e/records-workspace.spec.ts tests/e2e/task-workbench.spec.ts --project=chromium`：6/6 通过。
- `pnpm repo:safety`：通过。
- `git diff --check`：通过。

已执行但未全绿：

- `pnpm test:e2e`：13 passed、1 skipped、1 failed。失败用例 `tests/e2e/main-flow.spec.ts` 在第 110 行等待“发布新版本”按钮 180 秒后超时；页面仍停留在新建任务的草稿概览，尚未进入参与者上传、管理员上传详情、`/audit` 重定向或 `/records` 工作台。本任务实施前基线已出现同一失败，因此不作为本任务回归归因。

## Explicit delivery boundary

本地页面、查询和浏览器证据不能替代以下独立交付：

- 公网 URL 和云账号部署验收。
- Vercel/Supabase 生产配置验证。
- 真实多 GB、跨区域和跨天上传的生产 SLA 证明。
- 大规模数据量下的专项 SQL `EXPLAIN ANALYZE` 与索引容量验证。
