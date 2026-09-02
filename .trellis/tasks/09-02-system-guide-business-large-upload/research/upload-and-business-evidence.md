# Research: 大文件上传与业务恢复证据

- Query: 核对 TUS 暂停/恢复及服务端 offset、Supabase TUS URL 有效期与分片约束、Amazon S3 Multipart 的分片/恢复/完成/校验/清理语义，并给出不依赖数据库与代码名的 Leader 向业务表达。
- Scope: mixed（当前仓库、既有调研、官方协议与云厂商文档）
- Date: 2026-09-02

## Findings

### 结论摘要

面向 Leader 的核心解释应是：系统把大文件切成可独立确认的小段；暂停只停止后续传输，已经被上传服务确认的小段继续保留；恢复时先确认“还是同一个原文件”，再向上传服务查询真实进度，只补传未确认部分。刷新或重开页面后，浏览器出于安全限制不能自动重新读取电脑里的原文件，所以参与者需要重新选择一次原文件。取消则是终止本次上传并进入清理流程，不能与暂停混为一谈。

当前 MVP 的 TUS 路径只能承诺短时、受限恢复：单文件上限为 `50,000,000 bytes`，使用 `6 * 1024 * 1024` bytes（6 MiB）分片，上传资源按 24 小时管理。数 GB、跨天、弱网下“不重传已完成分片”属于未来 S3 Multipart 设计，当前没有实现或验收。

### 官方确认事实与设计含义

| 主题 | 已确认事实 | 面向业务设计的含义 | 官方来源（2026-09-02 获取） |
|---|---|---|---|
| TUS 真实进度 | 恢复前客户端对既有上传 URL 发 `HEAD`，服务端以 `Upload-Offset` 返回已接收字节；后续 `PATCH` 的 offset 必须与服务端当前值一致，否则返回 `409 Conflict` 且不修改资源。成功 `PATCH` 返回新的 `Upload-Offset`。 | 页面上的进度条只是反馈；断网、暂停或刷新后必须先向上传服务重新核对。文案应说“从上传服务确认的位置继续”，不要说“从浏览器记住的百分比继续”。 | [TUS 1.0 协议](https://tus.io/protocols/resumable-upload) |
| TUS 暂停与继续 | “暂停”是客户端行为：`abort()` 停止当前请求，但保留可恢复资源；再次 `start()` 会继续。只有请求 termination（`abort(true)`，且服务端支持终止扩展）才是销毁资源。 | 明确区分：暂停可继续，取消不可继续。暂停时可能有一片正在途中，最终保留多少必须以重新查询后的服务端结果为准。 | [tus-js-client Usage](https://github.com/tus/tus-js-client/blob/main/docs/usage.md), [tus-js-client API](https://github.com/tus/tus-js-client/blob/main/docs/api.md?plain=1), [TUS Termination](https://tus.io/protocols/resumable-upload) |
| TUS 刷新/重开恢复 | tus-js-client 可用文件 fingerprint 在浏览器 URL storage 中找回先前上传 URL；同一文件在另一个浏览器会话中重新选择后可恢复。浏览器缓存负责“找到这次上传”，不证明远端已接收多少。资源过期后，TUS 服务器应返回 `404` 或 `410`，客户端再创建新上传。 | 页面加载时先展示“待恢复上传”；参与者重新选择原文件；系统核对文件身份并找回远端会话；然后服务端确认 offset。找不到或已过期时必须明确提示“原上传通道已失效”，不能静默把进度重置为 0。 | [tus-js-client Usage](https://github.com/tus/tus-js-client/blob/main/docs/usage.md), [TUS Expiration](https://tus.io/protocols/resumable-upload) |
| Supabase 适用场景 | Supabase 推荐在文件可能超过 6 MB、网络不稳定或需要进度事件时使用 resumable upload，并建议大文件使用 direct storage hostname。 | 视频字节应直达存储服务，不经业务网页服务器中转；这既减少中转瓶颈，也把恢复进度交给真正接收字节的一方。 | [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) |
| Supabase 分片约束 | 当前官方 tus-js-client 示例将 `chunkSize` 固定为 `6 * 1024 * 1024` bytes，并注明暂时不要改变。官方页面使用“6MB”表述，精确代码值是 6 MiB。 | 当前页面可写“按约 6 MB 的小段上传”，技术附注写“实际为 6 MiB”；不要把 6 MB 误写成文件上限，它既是官方示例的当前分片值，也是官方建议采用 resumable 的文件量级门槛。 | [Supabase Resumable Uploads 示例](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) |
| Supabase URL 时限与并发 | 每次 resumable upload 会得到唯一 URL，所有分片用该 URL `PATCH`；URL 最长有效 24 小时，未完成则需重新开始。同一上传 URL 同时只能有一个客户端成功写入，另一个会收到 `409 Conflict`。 | 当前 MVP 不能承诺“几天后仍保留并复用原进度”，也不应允许两个标签页同时继续同一个上传。页面应显示过期风险并提供显式“创建新尝试”路径。 | [Supabase Upload URL / Concurrency](https://supabase.com/docs/guides/storage/uploads/resumable-uploads#upload-url) |
| S3 Multipart 分片与重试 | Multipart 的各 part 可独立、任意顺序上传；某片失败可只重传该片。相同 `partNumber` 的新上传会覆盖旧 part；完成时 S3 按 part number 升序拼接。 | 超大文件不会因一个分片失败而整文件重传；失败片可独立补传。但系统必须稳定维护 part 编号，不能让重试生成新位置。 | [S3 Multipart Overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) |
| S3 当前硬约束 | 当前官方限制为：最大对象 `48.8 TiB`；每次最多 `10,000` 个 part；part number 为 1–10,000；每片 5 MiB–5 GiB，最后一片可小于 5 MiB；`ListParts` 每页最多 1,000 片。 | 分片大小应按文件规模动态选择，保证总片数不超过 10,000；查询超大上传的远端分片必须分页。面向 Leader 无需展开全部数字，但设计附注应保留。 | [S3 Multipart Limits](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html) |
| S3 跨天恢复 | 当前 S3 文档说明 Multipart 初始化后本身没有到期时间，必须显式 Complete 或 Abort；但 bucket 生命周期规则可在指定天数后自动终止未完成上传。单个 presigned URL 有独立有效期，过期不等于 upload ID 自动失效。 | 跨天恢复的关键是保留同一个上传会话 ID 与分片回执。短期分片授权过期后，只为未完成片重新签发；但若上传已被用户取消或生命周期清理，则必须开启新会话。 | [S3 Multipart Overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html), [S3 Presigned URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [AbortIncompleteMultipartUpload 生命周期](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html) |
| `ListParts` 的正确角色 | `ListParts` 返回指定 upload ID 已上传的 part，一页最多 1,000；未完成上传的 part 不出现在结果中。它是“存储端现在实际持有哪些分片”的权威观察。AWS 同时明确要求 listing 只用于 verification，不要把原始 listing 直接提交 Complete；应用需维护经过校验的 part number 与 ETag 清单。 | 恢复时先用 `ListParts` 对账：存储端已有但系统回执缺失的片，经编号、大小和 checksum/ETag 校验后补入完成清单；系统预期有但存储端缺失的片才重传。Complete 必须使用对账后的受控清单，不直接透传 listing。 | [S3 ListParts API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListParts.html), [S3 Multipart listings](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) |
| 完成与合并 | `CompleteMultipartUpload` 需要完整 part 列表，每片带 `PartNumber` 和上传时返回的 `ETag`，S3 按编号升序组装。完成处理可能持续数分钟；初始 `200 OK` 中仍可能嵌入错误，调用方必须解析响应并按结果重试。 | 参与者看到 100% 后应进入“正在合并与校验”，不能立即显示“采集完成”。完成按钮应做成业务幂等：重复点击返回同一结果或继续核对，而不是重复创建资产；这属于应用设计，不是把原始 S3 Complete API 当作天然幂等。 | [CompleteMultipartUpload API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html) |
| checksum 与 ETag | S3 可在上传时独立计算并核对 checksum；Multipart 支持 full-object 与 composite checksum。提供的 full-object checksum 不匹配会报 `BadDigest`。Multipart 对象的 ETag 不是整文件 MD5，不能作为稳定的整文件内容哈希。使用 composite checksum 时，part number 必须从 1 开始连续。 | “分片都成功”后仍要做合并结果与整体完整性校验。图中可用“逐片确认 → 合并 → 整体校验”三层表达；不要把 ETag 称为整文件 SHA-256，也不要暗示未配置 checksum 时天然完成了业务所需的整体校验。 | [S3 Object Integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html), [S3 Multipart checksums](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) |
| 取消与残片清理 | 未 Complete/Abort 的 part 会继续占用存储并计费。Abort 后进行中的 part 仍可能随后成功，因此 AWS 建议用 `ListParts` 确认清空，必要时重复 Abort；同时推荐配置 `AbortIncompleteMultipartUpload` 生命周期作为兜底。 | “取消”不是隐藏进度条，而是终止上传、撤销继续资格并清理远端残片；后台还需有超期清理，以避免无人继续的上传长期占空间和成本。 | [AbortMultipartUpload API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_AbortMultipartUpload.html), [S3 Lifecycle Cleanup](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpu-abort-incomplete-mpu-lifecycle-config.html) |

### 当前仓库事实（不是未来承诺）

- `packages/core/src/domain/constants.ts:2-6`：当前单文件上限 `50,000,000 bytes`、每批最多 5 个文件、每位参与者最近 24 小时总量上限 `200,000,000 bytes`、TUS 分片固定 6 MiB。
- `packages/core/src/server/services/uploads.ts:59-60`：当前短期上传凭据按 2 小时声明，TUS 上传资源按 24 小时管理；恢复既有尝试时会重新取得凭据，上传资源与凭据有效期不是同一个概念。
- `packages/core/src/upload/tus.ts:31-57`：视频按服务端下发的分片大小直传，设置网络重试；`404/410` 被识别为资源过期。
- `packages/core/src/upload/tus.ts:61-83`：使用 `findPreviousUploads()` 找回原 TUS URL；如果预期恢复但 URL 丢失则拒绝启动；恢复失败时禁止在旧业务尝试下静默创建替代 TUS 资源。
- `packages/core/src/upload/persistence.ts:3-19`、`101-167`：浏览器保存文件身份、待恢复状态、已确认字节与到期时间；本地已确认进度只单调增加。
- `apps/participant-web/app/(portal)/uploads/upload-queue.tsx:186-234`：重新选择后必须同时匹配文件名、大小与完整 SHA-256；不一致时明确拒绝恢复。
- `apps/participant-web/app/(portal)/uploads/upload-queue.tsx:382-420`：页面动画进度来自 `onProgress`，真正持久化的已确认字节来自 `onChunkComplete`；上传完成后还要等待对象对账，才显示已验证。
- `apps/participant-web/app/(portal)/uploads/upload-queue.tsx:453-485`：暂停调用 `abort(false)` 并保留恢复记录；继续调用 `start()`；取消调用 termination、通知业务服务终止并删除本地恢复记录。
- `apps/participant-web/app/(portal)/uploads/upload-queue.tsx:502-531`：刷新后直接展示待恢复项，但要求参与者重新选择原文件。
- `packages/core/src/domain/upload.ts:54-70`：服务端侧拒绝倒退的已确认进度和超过文件大小的进度。
- `scripts/upload-check.ts:402-455`、`docs/acceptance/2026-09-02-local-mvp.md:43-56`：本地真实验证过超过一个 6 MiB 分片的合成 MP4，首片后暂停并使用原 TUS 资源继续；这证明多分片暂停/恢复，不证明 50 MB 边界、数 GB、跨天或生产云能力。
- `README.md:271-275`、`docs/acceptance/2026-09-02-local-mvp.md:120-125`：仓库明确声明当前没有 S3 Multipart 运行实现，也没有数 GB、4K、跨天或跨地区压力验证。

### 与既有调研的交叉核对

- `/Users/lienli/Documents/work/深度调研/research/egocentric-video-data-collection-mvp/answers/RQ001-如何设计-实现并公网部署一个用于第一人称日常活动视频数据采集的-MVP-使参与者和研究人员能够端到端管理任务说明-录制会话-外部录.md:400-464` 与官方资料一致：TUS 恢复以远端 `Upload-Offset` 为准，本地记录只是恢复索引，Supabase 单 URL 约 24 小时。
- 同文件 `:466-515` 的 S3 Multipart 路径整体正确：保留同一 upload ID、短期签发 part 权限、保存 part 回执、Complete 后再核验、过期 Abort。
- 需要比既有调研更严谨的两点：`ListParts` 是存储端已接收分片的权威观察，但应先对账并固化为系统校验过的清单，不能直接替代最终 Complete 清单；“幂等 Complete”应表述为业务层重复提交收敛与结果核对，不能宣称 S3 原始 Complete API 天然幂等。

### 可直接用于页面的业务文案

#### 分片为什么不会从头重传

> 系统不会把数 GB 视频当成一次不可分割的传输，而是切成一组可独立确认的小段。每上传成功一段，上传服务都会留下确认结果。网络恢复后，系统先核对已确认清单，只补传缺失的小段，因此一次断网不会让整个文件从头开始。

#### 暂停、断网、刷新与重开

> 点击“暂停”后，系统停止继续发送，但保留已经确认的进度；点击“继续”时先向上传服务核对真实位置，再从那里接着传。断网会自动进入短时重试。刷新或重开页面后，系统会显示待恢复任务；参与者需要重新选择原文件，系统确认是同一文件后，再查询已接收进度并继续。浏览器不会在参与者不知情的情况下重新读取本地视频。

#### 暂停与取消的差异

> 暂停是“稍后继续”，已确认内容继续保留；取消是“放弃这次上传”，系统停止继续、撤销恢复入口并清理残留内容。取消后若再次上传，将开启一次新的上传。

#### 100% 还不等于业务完成

> 进度达到 100% 只代表所有分片已经传送。系统还要完成分片合并、文件大小与完整性校验，并确认视频已归入正确的采集任务。只有这些步骤都通过，参与者才看到“提交成功”，管理员才把它计入有效采集进度。

#### 当前与未来边界

> 当前 MVP 已验证小型视频的分片直传、暂停与恢复，单个上传通道最长约 24 小时；它用于证明业务闭环，不代表已经具备数 GB 或跨天能力。生产方案将使用可长期保留上传会话和分片回执的 Multipart 机制：即使短期上传权限过期，也只重新取得缺失分片的权限，已成功分片无需重传。该方案仍需真实多 GB、跨天、弱网和异常清理验证后才能标记为已交付。

### 页面与 Archify 的设计约束

- 业务主图只展示“选择原文件 → 核对同一上传 → 查询已确认片 → 补传缺片 → 合并校验 → 成功”，不要出现数据库表、字段或内部对象模型。
- 明确画出三条分支：短时断网自动重试；刷新/重开后重新选择并恢复；上传会话过期或被清理后开启新上传。
- 暂停与取消必须使用不同终态：暂停返回主路径，取消进入终止/清理，不应都画成“停止”。
- 当前 TUS 图可用“已确认字节位置”；未来 Multipart 图用“已确认分片清单”。两者不要混成一个当前能力。
- 进度 100% 后保留“合并与完整性校验”阶段，成功状态在其后；异常进入可重试或人工处理，不直接算作采集完成。
- 对 Leader 可保留四个责任主体：参与者、上传页面、上传服务、管理员；内部存储与控制组件不应成为阅读主线。

### Files found

- `.trellis/tasks/09-02-system-guide-business-large-upload/prd.md`：本任务的业务流程、超大文件恢复与当前/未来边界要求。
- `apps/admin-web/app/(console)/system-guide/system-workflow-article.tsx`：现有双端流程文章，当前仍以内部实体名和技术链为主。
- `apps/admin-web/app/(console)/system-guide/resumable-upload-article.tsx`：现有 TUS/Multipart 说明，具备技术要点但需要改写成业务语言并修正 ListParts/Complete 语义。
- `docs/system-guide/diagrams/system-workflow.sequence.json`：现有管理员与参与者 Archify 时序图源。
- `docs/system-guide/diagrams/multipart-resume.sequence.json`：现有 Multipart 恢复图源，当前包含 Postgres、UploadAttempt 等内部实现语言。
- `packages/core/src/upload/tus.ts`：当前 TUS 创建、找回旧 URL、恢复与过期识别逻辑。
- `packages/core/src/upload/persistence.ts`：当前浏览器恢复清单与单调已确认进度逻辑。
- `apps/participant-web/app/(portal)/uploads/upload-queue.tsx`：当前参与者暂停、继续、取消、刷新后重选文件和完成对账体验。
- `packages/core/src/server/services/uploads.ts`：当前上传凭据、24 小时资源时限、进度约束与完成/取消行为。
- `scripts/upload-check.ts`：当前真实多分片、暂停与恢复集成验证脚本。
- `docs/acceptance/2026-09-02-local-mvp.md`：当前已验证/未验证能力边界。
- `/Users/lienli/Documents/work/深度调研/research/egocentric-video-data-collection-mvp/answers/RQ001-如何设计-实现并公网部署一个用于第一人称日常活动视频数据采集的-MVP-使参与者和研究人员能够端到端管理任务说明-录制会话-外部录.md`：既有 MVP 与生产大文件上传方案参考。

### Related specs

- `.trellis/spec/admin-web/frontend/quality-guidelines.md`：Archify HTML 必须维持精确 same-origin iframe 例外、严格 CSP、新标签页 fallback 和 E2E 响应校验。
- `.trellis/spec/admin-web/frontend/index.md`：系统指南属于 Admin frontend；除 iframe 场景外，大部分通用前端规范仍未填充，无法提供上传业务文案约束。
- `.trellis/spec/guides/cross-layer-thinking-guide.md`：页面若使用共享状态标签或数据合同，应核对图、文章和验证的跨层一致性。

## Caveats / Not Found

- 没有找到当前 S3 Multipart 运行实现、生产 bucket 配置或真实数 GB/跨天验收；未来方案不得标记为“当前已支持”。
- 当前真实集成测试证明了“超过一个 6 MiB 分片”的暂停/恢复，但不是浏览器关闭数天后的恢复，也不是恰好 50 MB 上限的上传证明。
- TUS core protocol规定 offset 与恢复，但“暂停按钮”是 tus-js-client 的客户端行为；TUS checksum 和 termination 都是可选扩展。没有当前证据证明 Supabase 路径启用了 TUS 每个 `PATCH` 的 checksum 扩展，因此不要把“服务端接受分片”写成“每片已按业务 checksum 校验”。
- Supabase 的“24 小时”是单个 TUS upload URL 的当前厂商边界，不是 TUS 协议的通用时限，也不是浏览器本地恢复记录的有效期。
- S3 当前官方上限已写为 `48.8 TiB`，不同于历史常见的 5 TiB 说法；后续若页面展示硬数字，应在发布前再次核对官方文档。
- S3 presigned URL 是短期 bearer credential；URL 过期后可重新签发，但能否恢复仍取决于同一 multipart upload 未被显式 Abort 或生命周期规则清理。
- 浏览器无法在刷新后无提示地重新取得本地 `File` 内容；“自动恢复”只能指自动找回待恢复任务，仍需要用户重新选择或使用具备持续文件句柄权限的专用桌面/浏览器方案。
