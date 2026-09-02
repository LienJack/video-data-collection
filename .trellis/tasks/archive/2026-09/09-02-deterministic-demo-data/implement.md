# Implementation Plan

## Guarded Reset

- [x] 提取 environment identity/inspection helpers；新增 dry-run 与双确认参数。
- [x] 实现 Storage 对象、显式业务表和 Auth users 的分阶段 purge 及幂等重试。
- [x] 添加“错误目标拒绝”“dry-run 零写入”“部分失败重试”测试。

## Deterministic Catalog

- [x] 建立 18 人 CN/US/JP 目录、3 个登录身份、设备、任务和场景 builders。
- [x] 使用 stable ids、public ids 和 `DEMO_SEED_ANCHOR`；验证 country/locale/timezone。
- [x] 重写 `scripts/seed.ts`，去除占位名称并构建健康/待审/缺失/不匹配/失败重试链。
- [x] 更新 fixture maintenance 为受保护 refresh 调度，不做状态逆向更新。

## Verification

- [x] 扩展 `scripts/seed-check.ts`：数量、名称/国家、状态分布、FK、RLS、Auth、Storage、MatchDecision。
- [x] 连续两次用同一 anchor refresh，比较稳定快照摘要。
- [x] 更新依赖旧 fixture 文案/ID 的 E2E，避免用自然语言当数据库 identity。

## Commands

- [x] `pnpm db:demo:refresh -- --inspect`
- [x] 经目标核对后：`pnpm db:demo:refresh -- --execute --confirm <exact-environment-id> --anchor <fixed-anchor>`
- [x] `pnpm db:test:seed && pnpm db:test:rls`
- [x] `pnpm participant:test && pnpm task:test && pnpm review:test`（实现检查阶段已通过；最终演示基线使用 seed/RLS 与聚焦浏览器验收，避免再次写入集成夹具）
- [x] `pnpm exec playwright test tests/e2e/main-flow.spec.ts --project=chromium`，随后受保护 refresh 恢复确定性基线。
- [x] `pnpm exec playwright test tests/e2e/records-workspace.spec.ts tests/e2e/task-workbench.spec.ts tests/e2e/system-guide.spec.ts tests/e2e/smoke.spec.ts --project=chromium`（12 passed / 1 WebKit-only skip）。
- [x] `pnpm exec playwright test tests/e2e/smoke.spec.ts --project=webkit-smoke`（3 passed），随后 refresh 恢复相同摘要。
- [x] `pnpm repo:safety && git diff --check`

## Dependency and Commit Boundary

- 状态机和 i18n child commits 必须先完成；seed 使用其 machine schemas 和 locale contract。
- 只在精确识别的当前 EgoCapture 环境执行删除；绝不调用通用 Docker/Supabase prune。
- 提交仅含 scripts/fixtures、相关测试、env 示例和任务文档；不含 `.env`、secret receipt 或媒体。
