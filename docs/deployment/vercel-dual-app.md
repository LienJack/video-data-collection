# Vercel 双应用部署

本仓库部署为两个彼此独立的 Next.js 应用。它们共享 PostgreSQL、Supabase Auth 和私有 Storage，但不共享页面、Route Handler、导航或认证 Cookie。

| Vercel Project | Root Directory | 建议域名 | 本地端口 | 独占能力 |
|---|---|---|---|---|
| Participant | `apps/participant-web` | `capture.example.com` | `3000` | 邀请、任务、Session、上传 |
| Admin | `apps/admin-web` | `admin.example.com` | `3001` | 参与者管理、任务配置、复核、审计、Cron |

## 共同变量

两个 Project 都需要 Supabase、数据库以及当前共享服务层使用的 server/browser 变量。以根目录 `.env.example` 为键名基准，并在 Cloud 使用：

```dotenv
STORAGE_UPLOAD_AUTH_MODE=official_signed
PARTICIPANT_SITE_URL=https://capture.example.com
ADMIN_SITE_URL=https://admin.example.com
```

不要把 NAS URL、NAS JWT 模式或本地数据库 URL 配到公网 Project。

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

1. 从同一 Git 仓库 Import 两次。
2. 分别选择上表的 Root Directory，Framework Preset 保持 Next.js。
3. 两个 Project 分别绑定自己的域名。
4. 只在 Admin Project 启用 `apps/admin-web/vercel.json` 中的 Cron。
5. 部署后确认 Participant 的 `/api/admin/audit-events` 返回 404，Admin 的 `/api/participant/assignments` 返回 404。
6. 使用管理员 Cookie 访问 Participant `/tasks` 必须进入 Participant 登录页；反向同理。
7. 从 Admin 生成邀请，URL host 必须等于 `PARTICIPANT_SITE_URL`。

这份配置实现的是部署单元隔离，不是数据库租户隔离。两端仍通过相同的服务层、RLS、角色检查和审计规则访问同一业务权威数据库。
