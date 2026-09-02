# Vercel Supabase 真实部署

## Goal

把 EgoCapture 的 Participant 与 Admin 两个应用部署到真实 Vercel，并建立独立 Supabase Auth/Postgres/private Storage 环境，提供可由美国 Leader 访问的公网演示地址和可复核验收证据。

## Background

- 2026-09-02 只读预检：Vercel CLI 53.1.0 与 Supabase CLI 2.116.0 均已登录。
- Vercel 当前团队没有 EgoCapture 项目；仓库和两个 App 没有 `.vercel/project.json` 关联。
- Supabase 组织 `lien` 只包含一个无关且 INACTIVE 的 Text2SQL 项目；仓库未 link，禁止触碰该项目。
- 用户最终选择美国节点优先 Leader 体验，同时尽量照顾中国访问：Supabase `us-west-1`（北加州）与 Vercel `sfo1`（旧金山）。
- 部署依赖状态机、i18n 和演示数据三个 child commit 全部通过。

## Requirements

### Resource boundary

- 新建或恢复本任务创建的 Supabase `egocapture-demo`；绝不复用/恢复/删除无关 Text2SQL 项目。
- 建立两个 Vercel Project：`egocapture-participant`（root `apps/participant-web`）与 `egocapture-admin`（root `apps/admin-web`）。
- 两个应用的 Node Functions 均固定 `sfo1`；Supabase 主项目固定 `us-west-1`，让 compute 靠近数据库/Storage。
- 使用 Vercel 默认 production URL 完成验收；自定义域名不是完成条件。

### Secure configuration

- 生成独立数据库密码、marker signing key、device HMAC key、Cron secret 和 demo passwords；不在命令输出、Git、task artifact 或验收文档中显示值。
- Participant/Admin 使用不同 Auth cookie name；共享 Supabase browser/server variables、database connection 和互相引用的 site URL。
- 公网只使用 `STORAGE_UPLOAD_AUTH_MODE=official_signed`，禁止 NAS URL/JWT 模式进入 Vercel。
- 环境变量配置后只验证 key presence/target，不读取回显 secret。

### Provision and deploy

- 在创建前再次验证账号、组织、项目名、区域与潜在计费；任何购买/升级提示必须停止并标记 `WAITING_EXTERNAL`。
- 对新 Supabase 环境按 migration ledger 顺序应用全部 migrations，验证 Auth/RLS/private bucket/Storage signed upload。
- 运行受保护的 demo refresh/seed，再分别构建和部署 Participant/Admin production。
- 部署过程必须可恢复：已有本任务 project ref/id 时继续使用，不重复创建同名资源。

### Public acceptance

- 验证两个 `/api/health`、页面加载、三语言切换/持久化和正确 `<html lang>`。
- 验证 Admin/Participant route 与 Cookie 隔离、未认证跳转和跨应用邀请链接 host。
- 用一个真实小视频执行 Participant 登录→任务→Session→Storage 直传→reconcile/metadata→Admin review；不把本地 E2E 当公网证据。
- 记录 URL、project refs/ids、区域、部署 id、commit、时间和逐项结果，不记录 secrets。

## Acceptance Criteria

- [x] Supabase 专用项目位于 `us-west-1`，两个 Vercel 项目 Functions 位于 `sfo1`。
- [x] migration ledger、RLS、Auth、private Storage、signed TUS 和 demo seed checks 在云环境通过。
- [x] 两个 production URL 可公开访问，健康检查通过且应用路由/Cookie 互相隔离。
- [x] `zh-CN`、`en`、`ja` 三语言在 production 切换并持久化。
- [x] 公网核心业务链及真实小对象直传完成，验收文档清楚区分 observed PASS、SKIP 与 WAITING_EXTERNAL。
- [x] Vercel/Supabase 日志和仓库中没有秘密泄漏，`pnpm repo:safety` 通过。
- [x] 若出现计费/权限/配额阻塞，未发生未经授权的购买或对无关项目的写入，并给出精确恢复步骤。

## Out of Scope

- 购买 Supabase/Vercel 付费套餐或 Enterprise 多区域部署。
- 自定义域名、企业 SSO、跨区域数据库副本和灾备演练。
- 生产级多 GB/跨天上传容量声明；公网 smoke 使用小型有效 MP4。
