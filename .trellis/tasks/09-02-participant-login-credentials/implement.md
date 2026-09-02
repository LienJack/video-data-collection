# 参与者可查登录凭据实施计划

## 1. Preflight

- [x] 读取仓库与 `apps/admin-web`、`apps/participant-web` 的 AGENTS 规则。
- [x] 按 Next.js 16.3.4 规则读取 `node_modules/next/dist/docs/` 中 Route Handler、Server/Client Component 与表单相关指南。
- [x] 记录工作树基线，确认本子任务不修改分页、drawer、任务详情动作或 bootstrap guidelines 文件。

## 2. Data and domain

- [x] 新增前向 Migration，创建 admin-only 一对一凭据表及 password、version、updated/synced 约束，不回填既有账号，也不向 anon/authenticated 授权。
- [x] 增加参与者专用随机密码生成器及单元测试。
- [x] 更新 seed，使 Fixture 的业务库密码与 Supabase Auth 密码保持一致。

完成标准：Migration 可重复执行/校验；现有账号不被批量重置；Fixture seed 幂等。

## 3. Participant lifecycle

- [x] `createParticipant` 在创建时生成 version 1 凭据，但不提前激活账号或 Consent。
- [x] `acceptInvitation` 使用已存系统密码创建 Supabase participant user；兼容旧的空凭据记录。
- [x] 删除参与者自行设置密码的邀请 API schema 与表单字段，保持确认、自动登录和 redirect 行为。
- [x] 更新邀请表单单元测试、`participant-check.ts` 与主流程 E2E 的密码获取方式。

完成标准：新建→邀请→接受→登录链路使用系统密码，状态与 Consent 语义不变。

## 4. Admin read and reset API

- [x] 单参与者详情加入 `loginCredential`，批量列表保持无密码字段，响应 no-store。
- [x] 实现凭据 prepare/resume/sync/finalize 服务与 reset route。
- [x] 保留 Trusted Origin、admin role、Fixture protection、row lock 和幂等防重。
- [x] 审计只记录版本与状态；错误与 command receipt 不含密码。

完成标准：missing、pending_activation、pending_sync、ready 四种状态可验证；失败重试复用同一 pending 密码。

## 5. Focused verification

- [x] `pnpm db:status`、目标环境 `pnpm db:migrate`、`pnpm db:verify`。
- [x] `pnpm test -- invitation participant-credentials accept-invitation-form`（按最终测试文件名调整）。
- [x] `pnpm auth:test`。
- [x] `pnpm participant:test`。
- [x] `pnpm typecheck`。
- [x] 运行主流程中邀请接受与参与者登录用例。
- [x] 搜索测试输出、API 样例和审计记录，确认真实密码未出现在禁止位置。

## 6. Review and commit

- [x] Trellis check 子代理复核认证一致性、失败恢复、权限边界、Migration 和测试覆盖。
- [x] `git diff --check`；显式暂存 Migration、凭据 domain/service/API、邀请 UI、seed/tests 与本任务 Trellis 文件。
- [x] 确认 staged diff 不含分页、drawer、`09-02-task-detail-actions`、bootstrap guidelines 或 `需求.md`。
- [x] 创建一个凭据子任务 scoped commit，并记录 commit SHA 后归档子任务。
