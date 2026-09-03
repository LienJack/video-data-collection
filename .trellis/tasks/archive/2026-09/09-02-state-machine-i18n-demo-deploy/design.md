# Technical Design

## Delivery Shape

父任务只拥有需求、依赖顺序和最终集成证据，四个子任务分别交付状态机、i18n、演示数据和真实部署。每个子任务独立验证、提交并归档，后一个任务只建立在前一个已提交且通过检查的快照上。

## Cross-Layer Architecture

```text
XState v5 domain machines
  -> service commands and atomic SQL transitions
  -> API error codes and audit events
  -> localized state labels and actions
  -> deterministic demo scenarios
  -> North California Supabase authority + San Francisco Vercel compute
```

- PostgreSQL 仍是业务权威。XState v5 machine 拥有应用层状态集合、事件和迁移图；数据库迁移拥有与其一致的更新守卫。服务端使用纯 transition 而非跨请求常驻 actor，契约测试验证两侧不漂移。
- i18n 只翻译界面、错误码和状态展示，不翻译数据库中的状态键，也不自动翻译管理员编写的任务内容。
- 演示种子只通过已定义的合法快照/命令构建场景；恢复演示环境使用受保护的清理再播种流程，不通过非法逆向迁移“倒带”。
- 两个 Vercel 应用继续共享一个专用 Supabase Auth/Postgres/private Storage 权威环境。视频字节继续由浏览器直传 Storage，不经过 Vercel Functions。

## Compatibility and Isolation

- 保留现有 URL，不采用语言前缀路由；语言通过显式选择 Cookie、登录后的 Participant locale 和首次 `Accept-Language` 协商获得。
- 保留现有 API 路径和成功响应结构；错误响应以稳定 `code` 为翻译键，现有 `message` 只作兼容回退。
- 当前工作区中的参与者抽屉、表格和任务详情改动属于其他 Trellis 任务。先完成并单独提交重叠任务，再开始本任务，不使用 stash、reset 或批量暂存覆盖它们。

## Deployment Topology

- Supabase project: new dedicated EgoCapture project in `us-west-1`.
- Vercel participant project: `apps/participant-web`, functions in `sfo1`.
- Vercel admin project: `apps/admin-web`, functions and Cron in `sfo1`.
- Default Vercel production URLs are sufficient for acceptance; custom domains are deferred.

## Rollback

- Code rollback uses the previous scoped commit or Vercel deployment promotion; schema changes are additive and retain old state text values.
- Failed seed refresh stops before public acceptance and can be rerun against the exact protected environment id.
- Failed deployment does not delete unrelated projects. Newly created cloud resources are retained for diagnosis unless the user separately asks to delete them.
- Secrets are rotated if a deployment command produces uncertain exposure; secret values never enter Git, task artifacts, shell output or acceptance records.
