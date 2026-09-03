# 参与者可查登录凭据技术设计

## Scope and authority

本设计只处理 `participant` 角色的本系统专用密码。Participant ID 继续是用户可见登录帐号，Supabase 内部 email 仅用于服务端映射。`admin` 账号仍完全由 Supabase Auth 管理，不增加可读密码字段或管理接口。

用户已明确批准参与者密码以明文运营字段持久化并允许授权管理员重复查看。即便如此，密码仍不进入批量列表、日志、错误、审计 payload 或浏览器持久化存储。

## Data model

新增前向 Migration，创建与 `egocapture.participants` 一对一的 `egocapture.participant_login_credentials` 表。密码仍是明文运营字段，但该表不授予 `public`、`anon` 或 `authenticated`，只允许服务端数据库角色访问，避免现有 Participants own-row RLS 通过 PostgREST 暴露凭据列。

- `participant_id uuid primary key references participants(id) on delete restrict`，避免删除 Participant 时静默丢失当前可交付凭据。
- `login_password text not null`：当前参与者密码；校验长度 12～128。
- `credential_version integer not null`：每次生成或重置递增，首个版本为 1。
- `password_updated_at timestamptz not null`：业务库密码最后生成时间。
- `password_synced_at timestamptz null`：该版本成功写入 Supabase Auth 的时间。

状态派生规则：

- 没有凭据行：`missing`，既有账号尚未初始化。
- 有密码且 `auth_user_id is null`：`pending_activation`，可复制但必须先接受邀请。
- 有 Auth 用户且 `synced_at >= updated_at`：`ready`，凭据已同步。
- 有 Auth 用户但未同步：`pending_sync`，接口不得宣称可用，重试复用同一待同步密码。

详情另返回 `canLogin`，只有凭据为 `ready`、Participant 为 `active` 且 Consent 为 `valid` 时才为 `true`。暂停、退出或 Consent 无效不会被误标记为“可直接登录”。

Migration 不更新既有行的密码，也不调用 Supabase Auth。Demo seed 使用 `DEMO_PARTICIPANT_PASSWORD` 写入 Fixture 的密码、版本和同步时间，使公开 Demo 的只读查看有一致数据。

## Password generation

在 core domain 中提供纯函数/Node crypto 生成器：使用密码学安全随机源，从排除 `0/O/o`、`1/I/l` 等易混淆字符的字母数字字符集中生成固定长度 16 的密码。生成器只用于参与者凭据，不接受用户输入，也不复用管理端环境密码。

## New participant and invitation flow

1. `createParticipant` 生成密码并与参与者记录一同插入：version=1、updated_at=now、synced_at=null。创建响应仍只返回 Participant ID。
2. 管理端单参与者详情可看到帐号、密码和 `pending_activation`，并明确提示凭据需先完成邀请激活。
3. 邀请生成仍使用单次 token hash 和现有状态保护，不把密码放进 URL。
4. 接受邀请 API 不再接收参与者输入的 password。`acceptInvitation` 在锁定参与者后读取已生成密码；兼容旧的 invited 行时若为空则生成并保存。
5. 服务使用该密码创建 Supabase Auth participant user，写 profile、Consent、active 状态，并将 synced_at 设为当前时间。
6. Route 仅在服务内部取得密码用于 `signInWithPassword`，公开响应仍只返回 Participant ID 和 redirectTo。React 接受邀请表单改为确认按钮，不渲染密码输入。

## Credential read contract

扩展受 admin 保护的单参与者详情返回：

```ts
loginCredential: {
  username: string;              // Participant ID
  password: string | null;
  loginUrl: string;              // PARTICIPANT_SITE_URL + /login
  version: number;
  status: "missing" | "pending_activation" | "pending_sync" | "ready";
  canLogin: boolean;
  updatedAt: string | null;
  syncedAt: string | null;
}
```

该字段不加入 `listParticipants`、任何 participant-facing API 或审计读取结果。API 响应设置 `Cache-Control: no-store`；前端只保存在当前 drawer React 状态中，关闭时清空。

## Initialize/reset contract

新增 `POST /api/admin/participants/[id]/credentials/reset`：

- Trusted Origin、admin 角色和 Idempotency-Key 必须通过。
- Demo admin 对 Fixture 继续触发 `FIXTURE_PROTECTED`。
- 无 Auth 用户时生成/替换业务库密码并保持 `pending_activation`，不改变参与者状态或 Consent。
- 有 Auth 用户时先在事务 Tx1 内锁定参与者并准备/持久化新版本，将其标记为 `pending_sync`；Tx1 提交后调用 Supabase Admin `updateUserById`；成功后在 Tx2 重新锁行、校验 version 并更新 `synced_at`。
- 若已有 `pending_sync`，重试必须复用相同 version/password，不能再次生成。
- Supabase 失败时保留 pending 状态并返回可恢复错误；再次调用继续同步。若 Supabase 已成功但最终 DB 标记失败，重试用相同密码再次写入 Supabase 后完成标记。
- 审计只记录 `credentialVersion`、`credentialStatus` 和动作类型，不记录 password。幂等命令回执只保存 Participant ID、version 和 status；Route 在事务外重新读取当前详情返回密码，避免回执持久化密码。

返回值与详情的 `loginCredential` 一致。只有 `canLogin=true` 才显示“可直接登录”；`pending_activation` 可复制但附带激活提示；`pending_sync` 要求重试后再交付。

## Compatibility and failure behavior

- 既有 active 账号保持原 Supabase 密码，直到管理员明确初始化；Migration 自身不会造成锁定。
- 既有 invitation 仍可接受，服务在接受时补生成密码；接受页面不再依赖客户端密码。
- Fixture seed 每次运行同时更新 Supabase participant 密码和业务库明文，保证测试/公开 Demo 一致。
- 如果应用代码回滚，新增凭据表可保留；已改为系统密码的参与者仍能通过原登录端点登录。
- 删除凭据表不是自动 rollback 步骤，避免丢失当前凭据。

## Verification focus

- 密码生成长度、字符集和非确定性单元测试。
- 新参与者 pending_activation、邀请接受、自动登录、再次登录。
- active 既有用户初始化/重置成功与旧密码失效。
- Supabase 失败/最终标记失败的 pending_sync 重试。
- anonymous、participant、admin、Demo Fixture 权限矩阵。
- list/API/audit/error 序列化中不出现 `loginPassword` 或真实密码。
