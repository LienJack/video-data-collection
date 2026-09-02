# Vercel 双应用部署

本仓库部署为两个彼此独立的 Next.js 应用。它们共享 PostgreSQL、Supabase Auth 和私有 Storage，但不共享页面、Route Handler、导航或认证 Cookie。

| Vercel Project | Root Directory | Production URL | 本地端口 | 独占能力 |
|---|---|---|---|---|
| `egocapture-participant` | `apps/participant-web` | `https://egocapture-participant.vercel.app` | `3000` | 邀请、任务、Session、上传 |
| `egocapture-admin` | `apps/admin-web` | `https://egocapture-admin.vercel.app` | `3001` | 参与者管理、任务配置、复核、审计、Cron |

两个 Project 使用 Node 24.x，`vercel.json` 将动态 Functions 固定到 `sfo1`。它们只连接专用 Supabase `egocapture-demo`（ref `phchhsatgoxlqqhpnnfk`，`us-west-1`）；现有 Text2SQL 项目不属于本部署。

## 共同变量

两个 Project 都需要 Supabase、数据库以及当前共享服务层使用的 server/browser 变量。以根目录 `.env.example` 为键名基准，并在 Cloud 使用：

```dotenv
STORAGE_UPLOAD_AUTH_MODE=official_signed
NEXT_PUBLIC_STORAGE_TUS_ENDPOINT=https://phchhsatgoxlqqhpnnfk.storage.supabase.co/storage/v1/upload/resumable/sign
PARTICIPANT_SITE_URL=https://egocapture-participant.vercel.app
ADMIN_SITE_URL=https://egocapture-admin.vercel.app
```

不要把 NAS URL、NAS JWT 模式或本地数据库 URL 配到公网 Project。
公网签名 TUS 必须使用同一 Supabase project ref 的直连 Storage 域名和 `/storage/v1/upload/resumable/sign`；Participant CSP 从这个精确配置派生允许的 `connect-src` origin，签名仍只通过 `x-signature` 请求头发送。

## Project 独立变量

Participant Project：

```dotenv
AUTH_COOKIE_NAME=egocapture-participant-auth
```

Admin Project：

```dotenv
AUTH_COOKIE_NAME=egocapture-admin-auth
```

Supabase SSR Cookie 不设置共享 `Domain` 属性，因此正式子域之间由浏览器执行 host-only 隔离；不同 Cookie 名同时保证 `localhost:3000` 与 `localhost:3001` 的开发环境不会串登录态。

## Vercel 配置

1. 从同一 Git 仓库创建两个 Project，并按上表设置 Root Directory；Framework Preset 保持 Next.js。
2. 在每个 App 目录执行显式 `vercel link --project <exact-name> --scope <exact-team>`；不要依赖自动 link 猜测多项目目标。
3. 只通过 stdin 或 Dashboard 写入 Production secrets；`vercel env ls production` 只审计键名和 scope，不读取秘密值。
4. 两端都使用 `sfo1`；只在 Admin Project 启用 `apps/admin-web/vercel.json` 中的 Cron。
5. 从固定 commit 的隔离 worktree 部署，避免把本地并行脏改上传到 Vercel。
6. 部署后确认 Participant 的 `/api/admin/audit-events` 返回 404，Admin 的 `/api/participant/assignments` 返回 404。
7. 使用管理员 Cookie 访问 Participant `/tasks` 必须进入 Participant 登录页；反向同理。
8. 从 Admin 生成邀请，URL host 必须等于 `PARTICIPANT_SITE_URL`。
9. 运行 `pnpm test:e2e:public`；该命令从环境读取 URL 与密码，并覆盖三地区登录、Cookie、健康检查和真实业务闭环，不在代码或报告中写秘密值。

这份配置实现的是部署单元隔离，不是数据库租户隔离。两端仍通过相同的服务层、RLS、角色检查和审计规则访问同一业务权威数据库。
