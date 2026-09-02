# Implementation Plan

## Domain Foundation

- [x] 精确安装 `xstate@5.32.6` 与 Participant app 的 `@xstate/react@6.1.0`，确认 lockfile、React 19 peer、TypeScript 与 Next production build 均正常。
- [x] 先迁移 Participant 为 XState v5 纯领域机器，新增项目适配层、稳定错误和穷尽性测试，并保留现有兼容导出。
- [x] 用两文件 fixture 建立最小 UploadQueue/UploadItem actor，验证 promise/callback cleanup、pause/resume/cancel 和 stale callback 拒绝；记录实际 client chunk 增量。
- [x] 最小垂直切片通过后，按研究清单建立其余 14 个持久化机器及完整上传队列机器；为派生分类补单一计算函数/测试。
- [x] 为状态显示导出稳定 machine/state 元数据，供 i18n 任务复用。

## Database Guard

- [x] 新增 additive migration：transition registry、通用 trigger function、各受控列 trigger 与固定边数据。
- [x] 添加 schema/registry 验证和直接非法 SQL 拒绝测试。
- [x] 添加 XState graph metadata ↔ PostgreSQL registry 一致性测试。

## Service Refactor

- [x] 按 Participant/Invitation/Device、Task/Assignment/Session、Upload/Metadata、Review/Maintenance 顺序迁移所有状态写入口。
- [x] 每个更新使用事务锁或旧状态条件；把 stale/illegal 分别映射为稳定错误码。
- [x] 保持跨实体 AuditEvent 与 idempotency receipt 在同一事务。
- [x] 删除 fixture maintenance 的逆向状态修复和数据库旁路；Cron 集成测试使用自有 fixture，演示恢复只允许显式清理后重建。

## Client Refactor

- [x] 把 `upload-queue.tsx` 的多处分散 setState 重构为父队列 actor + 每文件子 actor；长期恢复只保存有版本的最小应用 DTO。
- [x] 按机器可用事件渲染开始、暂停、恢复、重试和取消操作。

## Validation

- [x] `pnpm test -- tests/unit/state-machine.test.ts tests/unit/participant.test.ts tests/unit/assignment.test.ts tests/unit/upload.test.ts`
- [x] `pnpm db:verify`
- [x] `pnpm participant:test && pnpm task:test && pnpm session:test`
- [x] `pnpm upload:test && pnpm review:test && pnpm cron:test`
- [x] `pnpm typecheck && pnpm lint`
- [x] 两个 Next production build 通过，并记录 Participant 上传路由的实际 client chunk 变化。
- [x] `pnpm test:e2e -- tests/e2e/main-flow.spec.ts`
- [x] `git diff --check`；本实现代理未执行暂存，交由主代理按拥有文件精确暂存。

## Rollback Points

- 通用机器落地后先跑单元测试，再启用数据库 trigger。
- 每个服务簇迁移后运行对应集成脚本，失败时只回退该服务簇修改。
- 不在本子任务清理业务数据或操作云环境。

## Evidence

- Runtime authority: `.env.development.local` selects `nas`; the existing `pnpm dev:nas` process owns an SSH tunnel to `data-agent-nas` on loopback ports 56521 (API) and 56522 (PostgreSQL). No local database container was started.
- Database: `pnpm db:migrate && pnpm db:verify` applied additive migrations through `0023` on NAS and verified 14 registry machines, 133 legal edges, and 15 triggers, including exact live TypeScript/PostgreSQL parity, a direct illegal-transition rejection probe, and absence of the fixture reverse-transition bypass.
- Unit/type/static checks: `pnpm test` passed 26 files / 105 tests; `pnpm typecheck`, `pnpm lint`, and `git diff --check` passed.
- Integration: Participant, Task, Session, Upload, Review, and Cron check scripts all passed against the NAS runtime. The scripts cover stale-write/idempotent replay behavior and verify audit/receipt effects are not duplicated.
- Browser: `pnpm exec playwright test tests/e2e/main-flow.spec.ts` passed the complete Admin-to-Participant upload and immutable review-correction flow.
- Production builds: Participant and Admin Next.js 16.3.4 builds passed. The measured upload client route delta versus the pre-XState baseline is +44,101 B raw, +14,378 B gzip, and +12,367 B Brotli.
