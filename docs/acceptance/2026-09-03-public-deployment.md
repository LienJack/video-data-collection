# 2026-09-03 EgoCapture Public Deployment Acceptance

本记录只证明固定代码提交 `a69858e33a5a027331e7c55b274d96e00142b93f` 在下列专用 Vercel / Supabase 资源上的一次公网验收。结果为 **GO**。没有购买、升级或修改任何无关项目；美国侧独立网络延迟没有观测条件，明确记为 **SKIP**。数据库主密码的防御性轮换因 Supabase 管理权限边界未完成，单独记为 **HOLD**，不把未完成动作包装成通过。

## 部署快照

| 资源 | 生产标识 | 区域 / 配置 | 状态 |
|---|---|---|---|
| Supabase | `egocapture-demo` / `phchhsatgoxlqqhpnnfk` | `us-west-1` | `ACTIVE_HEALTHY` |
| Participant Vercel | Project `prj_7d3CY9Ufac7mElPp8zFcj9XdrABq` / Deployment `dpl_9sxt527Z3n3vPsZEdFREQAnTKhZP` | root `apps/participant-web` / Node 24 / Functions `sfo1` | `READY` |
| Admin Vercel | Project `prj_uTBUH1q87MwrtdOpdiab7Wf7Jo4T` / Deployment `dpl_9ZpY84UREL6263KbjUrwRTapHxpU` | root `apps/admin-web` / Node 24 / Functions `sfo1` | `READY` |

- Participant: <https://egocapture-participant.vercel.app>
- Admin: <https://egocapture-admin.vercel.app>
- 两个最终 deployment 均从无 tracked diff 的 detached worktree 部署；Participant created at `2026-09-03 09:05:38 +08:00`，Admin created at `2026-09-03 09:05:38 +08:00`。
- 两套 Project 各有 19 个 Production 环境变量，Vercel CLI 只读取了名称、target 和 `Encrypted` 状态，没有读取值。
- 公网 TUS 只允许同一 Supabase ref 的 `*.storage.supabase.co/storage/v1/upload/resumable/sign`，使用官方 signed upload token；Participant CSP 只增加这一精确 origin。

## 数据库与安全边界

| 检查 | Observed result |
|---|---|
| Migration | ledger 共 24 条，frontier `0024`；checksum/顺序验证通过 |
| Demo catalog | anchor `2026-09-01T00:00:00.000Z`，digest `11aa5520a737325f0fc3c290346eebe7dee16e7d033ba7c87edcad81d9f6ad80` |
| Seed shape | 18 Participant、3 个可登录 Participant identity、7 Task、6 TaskVersion、12 Assignment、7 ReviewCase、12 baseline AuditEvent |
| RLS | 28/28 个受保护表启用 RLS；`anon` 表权限为 0；Admin 动态作用域可见 18 Participant/7 Task/12 AuditEvent，Participant 动态作用域只可见自己、1 Assignment、1 Task、0 AuditEvent |
| Storage | private `egocapture-raw`，50,000,000-byte limit；验收写入最终清理后物理对象数为 `0` |
| Target guard | environment id、DB host、API origin、direct Storage TUS origin、migration frontier 和 bucket 必须同属 ref `phchhsatgoxlqqhpnnfk` |

Supabase 组织中原有的 inactive Text2SQL 项目没有被恢复、链接、修改或删除。整个过程没有出现计费、配额或权限确认，也没有执行购买或套餐升级。

## 公网业务验收

隔离验收配置在 production alias 上运行仓库现有 `public-deployment.spec.ts` 与 `main-flow.spec.ts`，结果为 `4 passed (1.3m)`：

1. Participant/Admin `/api/health` 均返回数据库可用且 `migrationCount=24`；双向不属于本应用的 API 均返回 `404`。
2. `zh-CN`、`en`、`ja` 三个确定性 Participant identity 均能登录；`<html lang>` 与持久化 locale 正确，Secure/HttpOnly Cookie 不跨应用。
3. Admin production Cookie 与 Participant 分离；Admin locale 切换和 reload 持久化通过。
4. Admin 创建 Participant、邀请、Device、Task/不可变 TaskVersion 和 Assignment；Participant 接受邀请、确认任务、创建 Session/签名 Marker、直传视频；Admin 完成人工不可变纠正并在过滤后的 Activity 记录中读回审计原因。

全链路产生的临时审查记录 `RV-FQ7B6MRZ` 在清理前已由数据库和 Admin UI 双重证明存在 `review_case.correct_match` AuditEvent，且 before/after/reason 均非空。该临时记录随后随最终 guarded refresh 清除。

## 真实 MP4、TUS 与 Metadata

最终 `main-flow` 使用可解码小型 H.264 MP4，而不是 synthetic-invalid WebKit fixture。Observed evidence：

- 浏览器从 Participant 获取 official signed token，向同一 Supabase ref 的 direct-Storage TUS `/storage/v1/upload/resumable/sign` 上传；视频字节不经过 Next.js host。
- transient upload `UP-YJTHFB4S` / `e2e-2eeb06b7.mp4`：`metadata_status=extracted`、attempt `extracted`、container `MPEG-4`、codec `AVC`、`64×64`。
- MediaInfo 对 Supabase 对象执行 `2` 次 Range 请求并读取 `3,130` bytes；请求数和字节数都大于 0，format/codec/resolution 均由数据库读回。

这些 upload/session public id 只是验收证据，不是演示基线。最终 guarded refresh 返回 HTTP `200`，重新创建确定性目录并再次得到同一 digest；随后验证 Storage 物理对象数为 `0`。

## 日志与区域观测

- 对两个最终 deployment 执行 Vercel `--level error` 和 `--status-code 5xx` redacted scan：两端 5xx 均为 `0`，没有 MediaInfo/WASM、数据库连接池或 `MARKER_NOT_FOUND` 异常。
- Participant 2 条、Admin 4 条成功请求被 Node 24 的 `TimeoutNegativeWarning` 以 error level 记录，`statusCode` 为空；同一轮 health、Auth、Admin 页面、Participant Task 和 Upload 流程均成功。该运行时 warning 不改变本次 GO，但应在后续依赖升级中消除。
- 中国当前执行主机对 `/api/health` 各测 3 次：Participant total `323–538 ms`、中位数 `417 ms`；Admin total `307–429 ms`、中位数 `351 ms`，全部 HTTP `200`。
- 美国侧独立客户端延迟：**SKIP**。部署 Functions 位于 `sfo1`、数据库/Storage 位于 `us-west-1` 是配置事实，不被替代为美国用户体验测量结论。

## 凭据与会话轮换记录

早期 Playwright 失败诊断曾在本地工具输出中暴露旧 Admin demo password，随后另一次本地 APIRequest 诊断暴露了短期 Admin session token。补救已在继续验收前完成：

- 生成新的 Admin 与 Participant demo passwords，并通过 stdin 更新两个 Vercel Project 的 Production Sensitive variables；guarded refresh 删除并重新创建全部 4 个本任务 Auth users，使旧密码和既有 session/user identity 失效。
- 删除本地失败诊断 artifact；未把密码、Cookie、JWT、object URL 或 service-role key 写入 Git、README、task artifact 或本记录。
- 受 one-time Bearer 保护的 refresh route 只在临时 Admin deployment 存在；调用后立即删除对应 Sensitive variable 和临时 deployments，并把 production alias 恢复到固定提交。最终正式 `/api/internal/refresh-demo-environment` 返回 `404`。
- 数据库主密码防御性轮换为 **HOLD**：官方 Management API 需要当前本机不可读取的管理 token；最窄临时服务端尝试到达专用数据库，但 `ALTER ROLE postgres` 被 Supabase `supautils` 以 SQLSTATE `42501` 拒绝。数据库密码未改变，现有 Production `DATABASE_URL` 保持有效；未轮换共享 provider/service-role keys，也未留下 SQL 执行面。

## GO / SKIP / Remaining boundary

- **GO**：固定提交 `a69858e33a5a027331e7c55b274d96e00142b93f`、两套 Production、24 migrations、确定性 seed/RLS、三语言登录、Cookie/API 隔离、official signed TUS、真实 MP4 Metadata、Review/Audit、healthy-cn closed-session 回归和最终基线恢复。
- **HOLD**：数据库主密码防御性轮换需要 Supabase Dashboard 或可安全读取的 Management API token；现有密码未在本轮输出或 artifact 中暴露，故不阻断已经验证的应用 GO。
- **SKIP**：美国独立客户端延迟；没有把 `sfo1/us-west-1` 配置推断成测量结果。
- **未声明**：数 GB / 4K / 跨天或跨地区压力能力、合法真实 INSV 私有字段、二维码自动识别、恶意媒体扫描、企业灾备。
