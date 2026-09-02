# 状态机 Registry RLS 修复

## Goal

为 `egocapture.state_machine_transitions` 添加独立 RLS hardening 迁移，恢复 NAS 数据库安全检查全绿，同时保持现有状态机注册表的服务端读取行为。

## Requirements

- R1. 不修改已经执行过的 `0019_lifecycle_state_machine_guards.sql`；通过新的顺序迁移修复现存数据库。
- R2. 为 `egocapture.state_machine_transitions` 启用 PostgreSQL Row Level Security。
- R3. 不增加面向 `anon` 或 `authenticated` 的读写策略；状态机注册表继续只通过受信任的数据库/服务端路径访问。
- R4. 迁移可重复由现有 migrator 安全发现和执行，并且不改动状态机边集合、约束或触发器语义。
- R5. 添加静态回归测试，确保新增业务表不会再次遗漏 RLS hardening。
- R6. 只在 NAS-backed 本地开发数据库上执行迁移与验证，不启动 Mac 本地数据库容器。

## Acceptance Criteria

- [x] AC1. 新迁移顺序位于 `0023` 之后，并包含 `alter table egocapture.state_machine_transitions enable row level security`。
- [x] AC2. 数据库契约测试通过，且明确验证状态机注册表 RLS 迁移存在。
- [x] AC3. `pnpm dev:nas:migrate` 成功应用迁移，`pnpm dev:nas:check` 报告所有业务表均已启用 RLS。
- [x] AC4. `pnpm test -- tests/unit/state-machine-database-contract.test.ts`、`pnpm typecheck`、`pnpm lint` 与 `git diff --check` 通过。
- [x] AC5. 精确 live SQL 验证表的 `relrowsecurity = true`，同时状态机 registry 行数和边集合不被迁移改写。

## Notes

- 这是上一个状态机 child 独立检查发现的安全 hardening 缺口；与 i18n 无关，必须单独提交。
- 不使用 `force row level security`，因为服务端迁移与校验仍需要 owner/service-role 路径；外部角色没有 policy 时默认不可访问。
