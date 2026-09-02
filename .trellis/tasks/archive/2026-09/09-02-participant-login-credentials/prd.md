# 参与者可查登录凭据

## Goal

让管理员能够为低权限参与者账号查找、复制和重置本系统专用登录密码，并在保留邀请与 Consent 激活语义的前提下，使业务库中的可查密码与 Supabase Auth 实际密码保持一致。

## Background and confirmed facts

- 参与者使用 Participant ID 和密码登录；服务端将 Participant ID 映射到 Supabase Auth 的内部 email（`apps/participant-web/app/login/login-form.tsx:13-24`、`apps/participant-web/app/api/auth/participant-login/route.ts:8-37`）。
- 当前由参与者在接受邀请时设置密码；业务库没有密码列，Supabase Auth 不提供明文反查，因此既有密码无法恢复（`apps/participant-web/app/api/invitations/[token]/accept/route.ts:9-24`、`packages/core/src/server/services/participants.ts:541-607`）。
- 现有参与者创建、邀请生成、邀请接受、Fixture 保护、幂等命令和审计均集中在 `packages/core/src/server/services/participants.ts`。
- Demo seed 已掌握 Fixture 参与者的环境密码，可在 seed 时同步写入新增的可查字段（`scripts/seed.ts:133-175`、`scripts/seed.ts:204-218`）。

## Requirements

- R1. 系统为参与者自动生成不可混淆、适合消息复制的本系统专用随机密码；管理员或参与者不能录入个人自定义密码。
- R2. 业务数据库以可读字段保存参与者当前密码、凭据版本和 Supabase 同步时间；此存储决策只适用于 participant 角色，不改变 admin 密码存储。
- R3. 新建参与者时立即生成可查密码；在邀请接受前明确标记“待激活”，接受邀请后使用该密码创建 Supabase Auth 用户并保持现有 Consent 与 active 状态转换。
- R4. 邀请接受页不再要求参与者设置密码，只负责确认并接受邀请；成功后仍自动登录进入参与者任务页。
- R5. 授权管理员可通过单个参与者详情读取 Participant ID、当前密码、凭据版本和可用状态；批量参与者列表不得返回密码。
- R6. 管理员可显式重置密码。对已有 Auth 用户，重置必须同步 Supabase Auth；成功后旧密码失效，新密码可立即登录。
- R7. 既有参与者不在 Migration 或部署时被批量重置。没有可查密码的既有账号由管理员按需初始化；初始化前原密码保持有效。
- R8. Supabase 同步失败不得报告成功；重试必须能够恢复为业务库密码与 Supabase Auth 一致的状态，不能不断生成无法使用的新密码。
- R9. 密码不得写入日志、错误消息或审计 before/after/metadata；审计只记录凭据版本、是否同步和动作类型。
- R10. Demo 管理员可以查看已由 seed 同步的 Fixture 参与者凭据，但继续禁止重置受保护 Fixture。
- R11. 凭据读写 API 必须要求 admin 角色；参与者端、匿名请求及跨角色请求不得读取其他参与者密码。
- R12. 凭据明文不得落在现有 Participant own-row PostgREST 可读列中；使用独立 admin-only 存储或等价列权限隔离。

## Acceptance Criteria

- [x] AC1. 新建参与者拥有系统生成的可查密码，详情返回 `ready=false` 或等价待激活状态；批量列表响应不含密码字段。
- [x] AC2. 参与者打开邀请、确认接受后无需设置密码；管理员复制的 Participant ID 与生成密码可以登录，Consent 与参与者状态仍按现有规则变为 valid/active。
- [x] AC3. 管理员稍后重复读取同一参与者时获得相同当前密码，直到明确执行重置。
- [x] AC4. 对活跃参与者执行重置后，新密码能登录、旧密码不能登录；凭据版本递增，Supabase 同步状态为 ready。
- [x] AC5. 既有无可查密码的参与者在管理员确认前不发生认证变化；按需初始化后具备可查且可用的当前密码。
- [x] AC6. Supabase 更新失败时接口返回可恢复错误，不把未同步凭据标记为 ready；使用同一待同步密码重试可完成恢复。
- [x] AC7. Fixture、角色权限、Trusted Origin、幂等性和审计保护有自动化覆盖，任何审计与错误负载都不包含密码。
- [x] AC8. Migration、seed、参与者集成检查、认证检查、类型检查和相关单元测试通过。

## Out of Scope

- 管理端账号密码的存储、读取、重置或认证变化。
- 密码加密、一次性显示或让参与者自行选择密码。
- 绕过邀请/Consent 激活流程，或让待激活参与者直接进入任务工作台。
- 通过邮件、短信或第三方消息平台自动发送凭据。
- 在参与者批量列表、导出、日志或审计中暴露密码。

## Key Decisions

- 参与者密码是管理员可重复查询的运营字段，并以明文持久化；这是用户明确批准的产品边界。
- 明文凭据使用独立 admin-only 一对一表保存，避免改变参与者对自身业务资料的现有 RLS 读取范围。
- 密码由系统自动生成，避免参与者提交可能在其他系统复用的个人密码。
- 新账号在创建时生成凭据但继续通过邀请确认 Consent；既有账号只在管理员明确操作时初始化或重置。
