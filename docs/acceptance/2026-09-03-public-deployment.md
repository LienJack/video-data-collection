# 2026-09-03 EgoCapture Public Deployment Acceptance

本记录只证明固定代码提交 `4e6422c24dcc9a93889c0e7755dc8045530d4881` 在下列专用 Vercel / Supabase 资源上的一次公网验收。结果为 **GO**。没有购买、升级或修改任何无关项目；美国侧独立网络延迟没有观测条件，明确记为 **SKIP**。

## 部署快照

| 资源 | 生产标识 | 区域 / 配置 | 状态 |
|---|---|---|---|
| Supabase | `egocapture-demo` / `phchhsatgoxlqqhpnnfk` | `us-west-1` | `ACTIVE_HEALTHY` |
| Participant Vercel | Project `prj_7d3CY9Ufac7mElPp8zFcj9XdrABq` / Deployment `dpl_EcwY6XvsjduLJP5tXd7UvrC1H37c` | root `apps/participant-web` / Node 24 / Functions `sfo1` | `Ready` |
| Admin Vercel | Project `prj_uTBUH1q87MwrtdOpdiab7Wf7Jo4T` / Deployment `dpl_DgB7CFWmCr2YDU2Sv5gfAeoyjzeu` | root `apps/admin-web` / Node 24 / Functions `sfo1` | `Ready` |

- Participant: <https://egocapture-participant.vercel.app>
- Admin: <https://egocapture-admin.vercel.app>
- Participant deployment created at `2026-09-03 07:22:28 +08:00`；Admin deployment created at `2026-09-03 07:23:34 +08:00`。
- 两套 Project 各有 19 个 Production 环境变量，Vercel CLI 只读取了名称、target 和 `Encrypted` 状态，没有读取值。
- 公网 TUS 只允许同一 Supabase ref 的 `*.storage.supabase.co/storage/v1/upload/resumable/sign`，使用官方 signed upload token；Participant CSP 只增加这一精确 origin。

## 数据库与安全边界

| 检查 | Observed result |
|---|---|
| Migration | ledger 共 24 条，frontier `0024`；checksum/顺序验证通过 |
| Demo catalog | anchor `2026-09-01T00:00:00.000Z`，digest `11aa5520a737325f0fc3c290346eebe7dee16e7d033ba7c87edcad81d9f6ad80` |
| Seed shape | 18 Participant、3 个可登录 Participant identity、7 Task、6 TaskVersion、12 Assignment、7 ReviewCase、12 baseline AuditEvent |
| RLS | global Admin、Participant ownership、Assignment-scoped task access、浏览器直接写拒绝与不可变历史检查全部通过 |
| Storage | private `egocapture-raw`，50,000,000-byte limit；验收写入最终清理后物理对象数为 `0` |
| Target guard | environment id、DB host、API origin、direct Storage TUS origin、migration frontier 和 bucket 必须同属 ref `phchhsatgoxlqqhpnnfk` |

Supabase 组织中原有的 inactive Text2SQL 项目没有被恢复、链接、修改或删除。整个过程没有出现计费、配额或权限确认，也没有执行购买或套餐升级。

## 公网业务验收

`pnpm test:e2e:public` 在 production alias 上运行 Chromium，结果为 `4 passed (1.6m)`：

1. Participant/Admin `/api/health` 均返回数据库可用且 `migrationCount=24`；双向不属于本应用的 API 均返回 `404`。
2. `zh-CN`、`en`、`ja` 三个确定性 Participant identity 均能登录；`<html lang>` 与持久化 locale 正确，Secure/HttpOnly Cookie 不跨应用。
3. Admin production Cookie 与 Participant 分离；Admin locale 切换和 reload 持久化通过。
4. Admin 创建 Participant、邀请、Device、Task/不可变 TaskVersion 和 Assignment；Participant 接受邀请、确认任务、创建 Session/签名 Marker、直传视频；Admin 完成人工不可变纠正并在过滤后的 Activity 记录中读回审计原因。

全链路产生的临时审查记录 `RV-6AJGGMHM` 在清理前已由数据库和 Admin UI 双重证明存在 `review_case.correct_match` AuditEvent，且 reason 非空。该临时记录随后随最终 guarded refresh 清除。

## 真实 MP4、TUS 与 Metadata

`pnpm upload:test` 对 production Participant 使用 FFmpeg 临时生成的、可解码 5 秒 H.264 MP4，而不是无效 WebKit fixture。Observed evidence：

- signed direct-Storage TUS 多分片、首分片 pause、`findPreviousUploads()` resume、Complete 幂等全部通过；视频字节没有经过 Next.js host。
- transient upload `UP-36AV7LYX`：`metadata_status=extracted`、attempt `extracted`、container `MPEG-4`、codec `AVC`、`1280×720`、duration `5000 ms`。
- MediaInfo 通过 Supabase Range 读取 `11` 次、共 `10,334,688` bytes；两项均大于 0 且未超过 `24` 次 / `16 MiB` budget；device consistency 为 `matched`。
- 360 equirectangular metadata、同字节 duplicate review、Storage missing、size mismatch、损坏 MP4 的 Transfer/Metadata 隔离全部通过。

这些 upload/session public id 只是验收证据，不是演示基线。最终 guarded refresh 已清理 237 行验收图、1 个 Storage 对象和对应 Auth fixture，重新创建确定性目录并再次通过 seed digest 与 RLS。

## 日志与区域观测

- 对两个最终 deployment 执行 Vercel `--level error` redacted scan：没有 5xx status、MediaInfo/WASM 异常或业务异常。
- Participant 2 条、Admin 3 条成功请求被 Node 24 的 `TimeoutNegativeWarning` 以 error level 记录，`statusCode` 为空；对应 Auth、Dashboard、Tasks、Upload 页面在同一轮验收中均成功。该运行时 warning 不改变本次 GO，但应在后续依赖升级中消除。
- 中国当前执行主机对 `/api/health` 各测 3 次：Participant total `294–337 ms`、中位数 `330 ms`；Admin total `303–319 ms`、中位数 `314 ms`，全部 HTTP `200`。
- 美国侧独立客户端延迟：**SKIP**。部署 Functions 位于 `sfo1`、数据库/Storage 位于 `us-west-1` 是配置事实，不被替代为美国用户体验测量结论。

## 凭据与会话轮换记录

早期 Playwright 失败诊断曾在本地工具输出中暴露旧 Admin demo password，随后另一次本地 APIRequest 诊断暴露了短期 Admin session token。补救已在继续验收前完成：

- 生成新的 Admin demo password，并更新 Supabase Auth 与两个 Vercel Project 的 Production secret；旧值失效。
- 移除临时 Admin profile 的应用管理员权限后，执行受保护刷新，删除并重新创建全部本任务 Auth users，使已暴露 session 完全失效。
- 删除本地失败诊断 artifact；未把密码、Cookie、JWT、object URL 或 service-role key 写入 Git、README、task artifact 或本记录。
- 轮换后重新部署、完成 `upload:test` 与公网 `4/4`，最终再次执行 guarded refresh。

## GO / SKIP / Remaining boundary

- **GO**：固定提交、两套 Production、24 migrations、确定性 seed/RLS、三语言登录、Cookie/API 隔离、官方 signed TUS、真实 MP4 Metadata、Review/Audit、最终基线恢复。
- **SKIP**：美国独立客户端延迟；没有把 `sfo1/us-west-1` 配置推断成测量结果。
- **未声明**：数 GB / 4K / 跨天或跨地区压力能力、合法真实 INSV 私有字段、二维码自动识别、恶意媒体扫描、企业灾备。
