# EgoCapture MVP

EgoCapture 是一套第一人称视频数据采集与人工复核系统。它把“任务说明 → 外部录制 → Session Marker → 私有对象存储直传 → 轻量 metadata → 人工纠正 → 不可变审计”串成一条可操作证据链。

当前代码已经在 NAS 基础设施 + Mac 本地 Next.js 拓扑上完成真实浏览器闭环；公网 Vercel/Supabase 部署仍为 `WAITING_EXTERNAL`，不能把下面的本地证据理解为公开生产部署。

## 交付状态

| 项目 | 当前状态 |
|---|---|
| Public URL | `WAITING_EXTERNAL`（尚未部署） |
| Repository | [LienJack/video-data-collection](https://github.com/LienJack/video-data-collection) |
| Deployed Commit | `WAITING_EXTERNAL` |
| Admin Demo | 账号来自 `DEMO_ADMIN_USERNAME`（默认 `admin`）；密码来自 `DEMO_ADMIN_PASSWORD` |
| Participant Demo | `PT-23456789`；密码来自 `DEMO_PARTICIPANT_PASSWORD` |
| Supabase Project / Region | `WAITING_EXTERNAL` |
| Demo Upload Limit | `50,000,000 bytes` / 文件，5 文件 / 批次 |
| Deployment Date | `WAITING_EXTERNAL` |
| NAS Development Smoke | 2026-09-02 本地 MVP 全链路通过，详见 [验收记录](docs/acceptance/2026-09-02-local-mvp.md) |
| CI Result | [GitHub Actions CI](https://github.com/LienJack/video-data-collection/actions/workflows/ci.yml)；最终交付以固定 commit 对应的绿色 run 为准 |

公开部署完成前不会把 Demo 密码提交到 Git。开发环境的密码和密钥由脚本随机生成并保存在被忽略的 `.runtime/<profile>/`。

## 推荐演示路径

```text
Participant Demo 登录
→ 打开 Demo Only 短视频任务
→ 确认冻结的 TaskVersion content_hash
→ 创建 Recording Session
→ 展示并确认 Ed25519 签名二维码
→ 选择 MP4，逐文件选择 Session 或 Unable to Determine
→ TUS 直接上传私有 Storage
→ 查看 Transfer / Reconciliation / Metadata / Match 四层状态
→ Admin Demo 登录
→ 打开相关 ReviewCase
→ Correct Session / Device 并填写 Reason
→ 查看新旧 MatchDecision 链与 AuditEvent
```

二维码当前只负责生成、展示和保存签名载荷；MVP 不从视频画面读取二维码，也不自动判断任务是否完成。

## 架构与数据权威

```text
Mac / Browser
├─ Participant Next.js（独立域名 / Vercel Project）
├─ Admin Next.js（独立域名 / Vercel Project）
└─ Participant tus-js-client（视频数据面）
        │
        ├─ JSON / Auth / Review → Next.js Route Handlers
        └─ 视频字节 → Supabase Storage TUS

PostgreSQL
└─ Participant、TaskVersion、Assignment、Session、Upload、Match、Review、Audit 权威

Storage
└─ 私有对象字节；不根据文件名、厂商或二维码决定业务关系
```

- Next.js/Vercel 不代理视频，请求体中的视频字节为 `0`。
- Participant、Study、TaskVersion 与 object key 由服务端权限上下文推导。
- Session 创建时声明的 Device 是事实声明；metadata 只是后续一致性证据。
- VideoAsset 的当前 Session/Device 关系来自 `current_match_decisions`，不是一个可覆盖的 `session_id`。
- TaskVersion、ConsentRecord、MatchDecision 和 AuditEvent 按追加写模型保存；数据库 Trigger 阻止关键历史 UPDATE/DELETE。

主要工程目录：

```text
apps/participant-web/ 参与者 Next.js、邀请、Session 与上传 API
apps/admin-web/       管理 Next.js、管理 API 与 Vercel Cron
packages/core/        稳定领域规则、Auth、DB、Storage、Audit 和服务层
packages/ui/          两端共享的视觉基础，不包含页面或导航
database/migrations/ 显式 Migration、RLS、View 与约束
infra/nas/           五服务最小 Supabase Compose
scripts/             Migration、Seed、物理 Integration Checks
tests/               Vitest 与 Playwright
```

## 开发拓扑

### 默认：本机 Docker 基础设施

新 clone 默认使用 local profile：Docker 运行 PostgreSQL、GoTrue、PostgREST、Storage API 和 API Gateway；Next.js、Node 与测试仍在宿主机运行。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:local:setup
pnpm dev:local
```

默认端口：

- Supabase API / Storage：`127.0.0.1:54321`
- PostgreSQL：`127.0.0.1:54322`
- Participant Next.js：`localhost:3000`
- Admin Next.js：`localhost:3001`

`pnpm dev:local:setup` 会创建本地随机秘密、启动基础设施、执行 Migration、幂等 Seed 和 Seed 校验。普通 `down` 保留 volume；只有显式设置 `EGOCAPTURE_DESTROY_INFRA=YES` 后运行 `pnpm dev:local:destroy` 才删除专属 volume。

### 本项目默认使用：NAS Docker 基础设施 + Mac 本地业务 Web

该模式专门避免在内存较小的 Mac 上启动本项目 Docker：

```text
Mac
├─ Next.js / Node / Vitest / Playwright
└─ SSH Tunnel 127.0.0.1:56521 / 56522
      │
NAS Docker Compose（egocapture-dev）
├─ db
├─ auth
├─ rest
├─ storage
└─ api-gateway
```

NAS 不运行 Next.js，不同步应用源码，不暴露公网端口，也不接管 NAS 上其他项目。Compose 和运行时断言都要求恰好存在以上五个 EgoCapture 基础设施服务。

在不提交的 `.env.development.local` 中设置：

```dotenv
EGOCAPTURE_DEV_PROFILE=nas
NAS_SSH_HOST=your-nas-ssh-alias
NAS_REMOTE_ROOT=/vol1/your-user/work/video-data-collection/current
NAS_API_PORT=56521
NAS_DB_PORT=56522
```

常用命令：

```bash
pnpm dev:nas:setup    # 首次/恢复：infra → backup → migrate → seed → RLS/Auth check
pnpm dev:nas:infra    # 只启动或修复 NAS 五服务基础设施
pnpm dev:nas:tunnel   # 只运行受监督 SSH Tunnel
pnpm dev:nas:migrate  # 先备份 egocapture schema，再迁移并校验 checksum
pnpm dev:nas:seed     # 通过临时 Tunnel 幂等恢复 Demo 基线
pnpm dev:nas:check    # 健康、Migration、RLS、Auth
pnpm dev:nas          # NAS infra + Tunnel + Mac Next.js
pnpm dev:nas:down     # 停本项目 NAS 容器，保留 volume
```

启动前会检查 SSH key、NAS 可用内存 ≥ 3 GiB、`/vol1` 可用空间 ≥ 20 GiB、Docker Compose 和端口占用。NAS 端口只绑定 `127.0.0.1`；Tunnel 使用 `BatchMode`、`ExitOnForwardFailure` 与 keepalive。关键子进程退出时会联动关闭 Mac Next.js 和本次创建的 Tunnel，不终止未知进程或其他项目。

## Migration 与 Demo Seed

Migration 使用 `egocapture.schema_migrations`、顺序编号、事务和 SHA-256 checksum。已经应用的文件禁止修改，新增变化必须创建下一编号文件。

```bash
pnpm db:status
pnpm db:migrate
pnpm db:verify
pnpm db:seed
pnpm db:test:seed
pnpm db:test:rls
```

业务表全部位于 `egocapture` schema；Storage bucket 固定为 private `egocapture-raw`。项目不创建共享 `public` 业务表，也不安装全局 `auth.users` Trigger。

Seed 是幂等 Fixture 恢复，不是生产证明。它提供：

- 1 个受保护 Admin Demo 与 1 个 Participant Demo。
- 4 个不可变 TaskVersion。
- Missing、Upload Failed、Metadata Failed、Duplicate Candidate、Unmatched、Device Mismatch、Needs Review 七类可见异常。
- 明确标记为 `Demo Fixture` 的逻辑样本。

真实视频上传证明来自 `upload:test` 和 Playwright，而不是 Seed 的逻辑行。

## TUS 直传、暂停与恢复

- 支持 `.mp4`、`.mov`、`.insv`。
- 固定 `6 MiB` 分片。
- 单文件最多 `50,000,000 bytes`。
- 浏览器通过 `findPreviousUploads()` 与本地 fingerprint 恢复同一 TUS 资源。
- `fingerprint_v1 = SHA-256(file_size || first_1MiB || last_1MiB)`。
- Complete API 只查询对象存在与大小，不完整读取视频，并保持幂等。
- Duplicate Candidate 只进入 Review，不自动删除或拒绝。

Cloud/default 使用 Supabase 官方 signed upload token。当前自托管 Storage 版本的 signed `x-signature` TUS 路径会拒绝自身生成的 compact JWS，见 [Supabase Storage issue #1268](https://github.com/supabase/storage/issues/1268)。因此 NAS/local profile 使用 `nas_scoped_jwt`：短期 authenticated JWT 只授权一个精确 object key，仍由 bucket-specific RLS 限制；浏览器永远拿不到 service role key。该 workaround 不代表云端官方 signed upload 已失败，也不会被部署到 cloud profile。

## Metadata 与设备一致性

上传对账后由 Node Route Handler 做轻量解析：

- 主动超时 25 秒，Vercel `maxDuration = 60s`。
- 最多 24 个 Range 请求、实际读取最多 16 MiB。
- `mediainfo.js` 提供通用字段，`mp4box` 补充 MP4/QuickTime progressive parsing。
- 不抽帧、不解码、不调用 FFmpeg Worker、不生成代理视频。
- 保存 allowlist 后的容器、轨道、时间、设备和 360 投影字段，不保存原始 metadata JSON。
- 原始 serial 立即使用 Study Salt 做 HMAC-SHA256；GPS 只保存是否存在，不保存坐标。
- 缺失 metadata 显示 `metadata_unavailable`，不会被推断成 mismatch。

时间优先级固定为：可靠时区 QuickTime creation date → container create time → track create time → 浏览器 `lastModified` → unknown。上传时间永远不是 capture time。

## Review、Audit 与每日对账

Admin 的 Confirm/Correct、Reject、Request Re-record、延期和暂停操作都要求 10～500 字符 Reason。纠正会新增 MatchDecision，并通过 `supersedes_decision_id` / `superseded_by` 保留完整历史。

`/api/cron/reconcile` 由 `CRON_SECRET` Bearer 鉴权，Vercel Hobby 每日 UTC 03:17 调用一次。每次最多尝试 10 个卡住的业务对象，并处理：

- 过期 UploadIntent 与 Attempt。
- 卡住的对象对账和 metadata processing。
- 7 天 Demo Storage 对象保留期：只删除字节并记录 `deleted_at/delete_reason`，不抹除业务或审计历史。
- 受保护 Demo Fixture 基线修复。

Cron 是兜底，不承担实时链路；Complete 与浏览器 metadata 调用仍是主路径。

## 测试与验证

```bash
pnpm check             # ESLint + strict TypeScript + Vitest + production build
pnpm repo:safety       # 拒绝明显提交秘密、大文件和大媒体 Fixture
pnpm auth:test
pnpm participant:test
pnpm task:test
pnpm session:test
pnpm upload:test       # 多分片真实 TUS、暂停/恢复、损坏 MP4、metadata
pnpm review:test       # 新旧 MatchDecision、signed Range preview、Audit
pnpm cron:test
pnpm test:e2e          # Chromium 主流程 + WebKit smoke
```

Playwright 的主流程真实上传一个有效 MP4，并验证视频请求目标是 Storage/NAS Gateway，而不是 Next.js。本轮 [本地验收记录](docs/acceptance/2026-09-02-local-mvp.md) 包含：

- quality：lint、type、30 个单元测试、两套独立 production build。
- browser-acceptance：在 NAS 五服务 Docker + Mac 本地 Next.js 上依次通过 13 个 Migration/checksum、RLS、Chromium 主流程与 WebKit 实际 TUS smoke（4 passed，1 个按项目条件 intentional skip）。
- repository-safety：明显秘密和大媒体检查。

## 隐私与安全边界

- Demo 只能使用合成身份和无 PII 视频。
- 原文件名仅用于人工定位：去路径/控制字符、最长 255 字符、不进入 object key 或 Audit diff。
- Marker、object key、URL 与日志不包含姓名、邮箱、任务标题或序列号。
- Participant 创建 Session/Upload 时服务端重新校验身份、状态、Consent 与 Study。
- 普通 authenticated 用户没有任意 Storage INSERT/SELECT 权限。
- private bucket 下载只通过单对象、5 分钟 signed URL。
- CSP、`frame-ancestors 'none'`、HTTP-only Cookie 与 Origin 检查已启用。
- MVP 没有恶意文件扫描、自动内容隐私检测或自动数据删除治理流程。

## 公网部署 Runbook

云端目标是既定共享 Supabase 项目 + Vercel Hobby；NAS 永远不是公网 Demo。

1. 确认 Supabase CLI 与 Vercel CLI 登录，并人工确认 project ref。
2. 读取 PostgreSQL 版本、现有 Exposed Schemas、Auth Email 和 bucket；任何同名非本项目对象都进入 `HOLD`。
3. 备份已有 `egocapture` schema。
4. 设置云 `DATABASE_URL`，执行 `pnpm db:migrate && pnpm db:verify`。
5. 确认 private `egocapture-raw` bucket 的 50,000,000 bytes limit。
6. 将 `egocapture` 追加到 Exposed Schemas，禁止覆盖现有值。
7. 执行 `pnpm db:seed && pnpm db:test:seed`。
8. 创建两个 Vercel Project，Root Directory 分别设为 `apps/participant-web` 与 `apps/admin-web`，不要把它们合并为同一 Project 的路径路由。
9. 两个 Project 都配置 `.env.example` 中的共享后端变量；cloud 设置 `STORAGE_UPLOAD_AUTH_MODE=official_signed`。Participant 设置 `AUTH_COOKIE_NAME=egocapture-participant-auth`，Admin 设置 `AUTH_COOKIE_NAME=egocapture-admin-auth`。
10. 设置 `PARTICIPANT_SITE_URL` 和 `ADMIN_SITE_URL` 为各自正式域名；邀请链接必须使用前者。只有 Admin Project 包含 `/api/cron/reconcile` 和 Vercel Cron。
11. Preview 部署并运行登录、TUS、metadata、RLS、Review 与双向 404 隔离 smoke。
12. 通过后发布 Production，并把两条真实 URL、账号密码、commit、region 和日期更新到本 README。

两套 Vercel Project 的精确配置见 [双应用部署说明](docs/deployment/vercel-dual-app.md)。

当前 Vercel CLI 已登录，但仓库尚未绑定 Vercel Project；Supabase CLI 可见的共享项目尚未被本仓库 link、目标 project ref 未获明确确认，并且项目状态为 `INACTIVE`。因此云阶段仍为 `WAITING_EXTERNAL`：确认并恢复既定共享 Supabase 项目后，才能执行冲突检查、Migration、Preview 验收和 Production 发布。不得使用新建 Supabase 项目、NAS 公网映射或关闭隔离规则绕过。

## 生产演进

### 数 GB / 4K 上传

MVP 只真实验证到 50 MB，不声称具备数 GB、跨天、跨地区或 4K 长视频能力。生产演进使用 S3 Multipart、IndexedDB 恢复、服务端 ListParts 权威、part checksum/ETag、幂等 Complete 与过期 Abort；Vercel 仍不代理视频。

### 视频内 QR 自动匹配

未来链路为 `VideoAsset → Frame Extraction → QR Decode → Ed25519 Verify → RecordingSession Lookup → MatchEvidence → MatchDecision/ReviewCase`。自动结果只能形成证据，不直接覆盖人工决策。MVP 不包含 FFmpeg、抽帧、二维码识别依赖或“已自动识别”占位状态。

### 直播

未来可选择 Insta360 App → RTMP → Mux/Cloudflare Stream，或自研移动端 → AWS IVS。直播流只用于监控/代理录制，原始 4K 文件仍走断点上传。MVP 不创建直播账号、SDK、Stream Key 或相关表。

## 已验证与未验证

| 能力 | 状态 | 证据边界 |
|---|---|---|
| NAS 仅五服务 Docker、Mac 本地 Next.js | 已验证 | 物理 NAS 容器、loopback binding、Tunnel 关闭检查 |
| Migration / Seed 重跑 | 已验证 | 13 个 Migration checksum；Seed 幂等恢复与约束检查 |
| Auth / RLS / Study 隔离 | 已验证 | Integration 与数据库测试 |
| Ed25519 Marker | 已验证 | 单测、Session Integration、浏览器二维码 |
| TUS 多分片、Pause/Resume、Complete | 已验证 | 约 9.8 MB 合成 MP4 物理上传；浏览器短 MP4 |
| Range metadata / 360 / 损坏文件 | 已验证 | 手机 MP4、合成 360 MP4、损坏 MP4；16 MiB budget |
| Admin 不可变纠正与 Audit | 已验证 | Playwright + `review:test` |
| 本机 Docker 模式 | 已验证 | GitHub Ubuntu Runner 启动五服务 Docker；Next.js 在宿主机运行；最终交付以固定 commit 对应的 [CI](https://github.com/LienJack/video-data-collection/actions/workflows/ci.yml) 为准 |
| Public Vercel/Supabase Demo | `WAITING_EXTERNAL` | 尚无公开 URL |
| 真实 INSV 私有字段 | 未验证 | 无合法样本 |
| QR 自动识别 / 内容检查 | 未实现 | 仅演进接口文档 |
| 数 GB / 4K / 跨天上传 | 未实现 | 仅 Multipart 数据模型与演进方案 |
| 直播 | 未实现 | 仅 README 方案 |
