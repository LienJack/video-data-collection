# 系统说明文档中心技术设计

## Delivery boundary

本任务交付一个 Admin Web 内的说明中心和四张交互式 Archify 图，不改动 Participant Web 导航，不实现新的上传协议或直播运行时。四篇文章共享同一条受保护路由、目录、图表容器和视觉语言，因此保持为一个集成任务，不拆成子任务；拆分会重复页面骨架、图表嵌入和浏览器验收，不能形成更独立的可交付物。

## Route and authorization

- 新页面位于 `apps/admin-web/app/(console)/system-guide/page.tsx`，URL 为 `/system-guide`。
- `(console)/layout.tsx` 已在共享布局中调用 `requireAdmin()`，因此直接访问说明页与其他 Admin 页面拥有相同的认证和角色边界，不额外创建公开路由或 API。
- 页面是无数据依赖的 React Server Component；内容随代码版本发布，避免在运行时从外部文档站或未受控 Markdown 拉取内容。
- 页面导出专属 Metadata，标题明确为“系统说明 · EgoCapture”。

## Entry placement

在 Admin 共享布局中加入一个全局 `SystemGuideLink`：

- 桌面端放在内容列右上角的轻量 utility action，使用 `BookOpenText` 图标和“系统说明”文字；它不加入五个核心运营主导航，避免把说明页误认为业务队列。
- 移动端放在现有右上角操作区，与“全部功能”菜单并列或作为其明确条目，保留至少 44px 点击目标。
- `/system-guide` 时使用 `aria-current="page"` 和选中态；链接使用 Next.js `Link`，保持共享布局与客户端导航。
- 入口不能覆盖页面标题、操作按钮或移动端安全区；通过页面级 Playwright 截图和横向溢出断言验证。

## Documentation information architecture

说明中心采用一个 URL、四个语义化 `<article>` 与锚点目录：

1. `#system-architecture`：整个系统的架构。
2. `#system-workflow`：管理员与参与者联动流程。
3. `#resumable-upload`：当前 TUS 与未来 Multipart。
4. `#live-capture`：未来直播推流与服务端录制。

桌面端使用两列布局：左侧 sticky 目录，右侧正文；窄屏目录变为顶部可横向浏览的锚点导航。正文使用共享页面 token、Card、Badge 与现有 Geist 字体，不引入 MDX、文档 CMS 或新的运行时依赖。每篇文章固定包含：

- 状态标签：`当前已实现`、`未来方案` 或两者并列。
- 结论先行与边界说明。
- 图表及可在新标签页打开的交互图链接。
- 关键步骤、状态/失败路径和安全边界。
- “依据与延伸阅读”，链接到协议或供应商官方资料；仓库实现事实则标注对应模块名。

长文拆为四个纯 Server Component 文章组件，并共享 `GuideSection`、`GuideDiagram`、`StatusPill` 等小组件。内容仍以 TSX 随代码版本管理，避免解析不可信 HTML；Archify HTML 仅来自本仓库生成并提交的静态产物。

## Diagram set and embedding

交付四张中文 Archify showcase 图：

| Article | Archify type | Main truth |
|---|---|---|
| 系统架构 | `architecture` | 双 Web 应用、控制面、PostgreSQL 权威、TUS 数据面、私有 Storage 与后台处理边界 |
| 双端联动 | `sequence` | Admin 发布/分配、Participant 确认/建 Session/上传、后台处理、Admin 审核与 Audit 闭环 |
| 断点大文件上传 | `sequence` | 创建 Multipart、并发 parts、暂停、同一 `uploadId` 恢复与补签、Complete、Head/Checksum 核验 |
| 直播采集归档 | `sequence` | 短期推流授权、参与者推流、直播平台录制、S3 归档、幂等事件回调、Admin 回看 |

图表 JSON 规格放在 `docs/system-guide/diagrams/`；交互 HTML 放在 `apps/admin-web/public/system-guide/diagrams/`。页面通过同源 `<iframe>` 延迟加载 HTML，设置可识别 `title`、固定比例/最小高度和独立“打开交互图”链接。图表是构建时静态资产，不向 Viewer 注入业务数据或登录凭据。

Admin 当前全局 `frame-ancestors 'none'` / `X-Frame-Options: DENY` 会阻止 public HTML 被同源 iframe 加载。`next.config.ts` 必须在全局安全头之后为 `/system-guide/diagrams/:path*.html` 添加更具体的覆盖：只允许 `frame-ancestors 'self'`、`X-Frame-Options: SAMEORIGIN`，并用独立最小 CSP 禁止网络连接、表单和 object。Next.js 16.3.4 的 `headers` 合同规定后匹配的同名 header 覆盖先匹配值；最终仍需浏览器与响应头断言验证。

Archify 生成遵循以下证据链：

1. 每种类型只读取对应 schema、common schema 和一个示例；先写候选规格。
2. 首个候选后运行 update checker，但不自动修改已安装 Skill。
3. 每次候选修改后执行 showcase `validate`；最终交付使用一次 `deliver`。
4. 对精确交付 HTML 执行 `visual-check`，再以图像能力审阅截图；确定性交付、浏览器行为与人工视觉审阅分别报告。

## Article 1: current architecture truth

架构文章按仓库当前实现描述：

- Admin Web 与 Participant Web 是独立 Next.js 应用，共享 `packages/core` 与 `packages/ui`。
- JSON/Auth/业务命令经过 Next.js Route Handlers 与 Core services；PostgreSQL 是 Participant、TaskVersion、Assignment、RecordingSession、Upload、Match、Review 与 Audit 的权威。
- 视频字节由 Participant 浏览器的 `tus-js-client` 直达私有 Storage，不经过 Vercel Function。
- Storage object key 由服务端推导；文件名、厂商 asset ID、二维码或 metadata 都不成为业务身份权威。
- metadata/reconcile/review 是控制面状态推进，不把本地验收写成公网生产部署。

## Article 2: Admin and Participant collaboration

联动时序以当前闭环为准：

1. Admin 创建并发布不可变 TaskVersion，将 Participant 分配到 Assignment。
2. Participant 登录、查看并确认 TaskVersion，创建绑定 Assignment/Device 的 RecordingSession。
3. Participant 展示并确认签名 marker，外部录制后手动选择 Session 创建 UploadIntent/UploadAttempt。
4. 浏览器 TUS 直传 Storage；完成命令只触发服务端 reconcile，不能单独证明对象存在或身份匹配。
5. 后台核验对象、提取轻量 metadata、生成 ValidationRun/MatchDecision；异常进入 ReviewCase。
6. Admin 复核或产生 superseding MatchDecision，所有关键动作追加 AuditEvent。

## Article 3: resumable large upload

文章分成两个明确层次：

### Current TUS implementation

- `fingerprint.worker.ts` 在 Worker 中计算文件指纹/摘要；`persistence.ts` 在浏览器保存 Upload/Attempt、已接收字节、过期时间和状态；`tus.ts` 使用稳定 fingerprint 查找 previous upload。
- TUS 以服务端 offset 为恢复真相，客户端缓存仅用于找回资源；404/410 进入资源过期恢复路径，成功后移除 fingerprint。
- 当前路径适合 MVP 的分片、暂停、刷新与受限恢复演示；Supabase TUS upload URL 约 24 小时，不能承诺跨天长期复用。

### Future Multipart reference path

- 控制面创建业务 UploadAttempt 后调用 `CreateMultipartUpload`，持久化 provider、region、`uploadId`、checksum contract 与 part manifest。
- 客户端仅获得所需 part 的短期 presigned URL，并发上传，逐 part 回传 `partNumber + size + ETag/checksum`；重复 receipt 幂等合并。
- 切网、关闭或 URL 过期后，重新选择原文件并验证 fingerprint；服务端核对同一 UploadAttempt/ListParts，只对缺失 part 补签，不创建新的 multipart upload。
- `CompleteMultipartUpload` 使用有序 manifest；随后 `HeadObject`/provider receipt 与完整对象摘要完成二次核验，再推进 StoredObject/VideoAsset。
- 放弃或过期会话显式 Abort，生命周期策略清理残留 parts；未完成分片成本、checksum 类型兼容、并发与退避是上线前验证项。
- 迁移 `0013_multipart_evolution_reservation.sql` 已预留 `part_manifest`、`completion_receipt` 与 `multipart_upload_parts`，文章只解释演进合同，不启用它。

## Article 4: future live capture and recording

采用“供应商适配器 + AWS IVS 具体参考实现”的方案，避免把供应商变成业务权威：

1. Participant 从已有 RecordingSession 请求创建 LiveCapture；控制面创建内部记录并通过 provider adapter 创建/分配 IVS Channel，返回短期 broadcast authorization，不返回长期 AWS 凭据。
2. Web 采集端优先使用 IVS Web Broadcast SDK；外部相机或编码器可使用 RTMPS/SRT 适配。断线时客户端带有界退避重连，同一内部 LiveCapture 记录重连窗口。
3. IVS ingest 负责接收和分发；Auto-record to S3 把 HLS manifests、segments 与 recording metadata 写入系统控制的私有 bucket。管理端不是从播放器下载后再“保存”，而是观察自动归档状态。
4. EventBridge/recording state change 进入幂等 provider event inbox；以 `provider + event_id` 去重，并以 Recording End/Failed 与 S3 metadata 为对账依据。
5. Worker 在 Recording End 后解析 provider metadata、核对 bucket/prefix/RecordingSession，登记 StoredObject/VideoAsset 并进入现有 Validation/Match/Review 链。
6. Admin 页面读取内部 LiveCapture/VideoAsset 状态，通过短期 signed playback URL 回看；停播、密钥轮换、访问审计、保留/删除仍由本系统控制。

Cloudflare Stream/Mux 可作为替换 adapter，但正文不承诺一致的录制格式、数据驻留、导出或删除合同。真实选型前需要对 DPA、区域、原片导出、回调语义和单位成本做独立验收。

## Compatibility, security, and rollback

- 不修改数据库、API 或 Participant Web；新增页面对现有业务数据只读且无查询。
- `/system-guide` 继承 Admin auth；静态 Archify HTML 不包含账号、对象 key、签名 URL、真实 Participant ID 或环境变量。
- 全局 Admin 页面继续禁止 framing；仅 committed diagram HTML 路径允许同源 iframe，并采用不开放外部 `connect-src` 的专用 CSP。
- 外部参考链接使用 `rel="noreferrer"` 并清楚标记；图表 iframe 只加载同源 committed artifact。
- 回滚只需移除 Admin utility link、说明页组件与静态图表，不影响运营路由、上传或数据库。
- 工作区已有其他未提交 Trellis 任务和 `需求.md`；提交必须显式暂存本任务文件，禁止使用宽泛 `git add .`。

## Verification strategy

- Archify：四份 JSON 均达到 9 项 showcase 检查、0 composition errors、0 warnings；四份 HTML `deliver` 成功并保存 SHA-256 receipt；`visual-check` 覆盖桌面视口。
- Static/product checks：ESLint、strict TypeScript、Vitest、Admin production build 与完整 `pnpm check`。
- Playwright：Admin 登录后入口可见、Participant 页面无入口、直达 `/system-guide` 受保护、四个锚点与四个 iframe 存在、交互图可打开；1440px 与 390px 无横向溢出。
- Perceptual review：检查页面目录、长文密度、图表可读性、当前/未来标签、桌面与移动布局；该结论与自动化证据分开记录。
