# Design：中文项目架构与视频采集上传 README

## Documentation Boundary

直接重写根目录 `README.md`，不创建第二份架构说明。README 定位为面向工程师与项目 Leader 的系统设计入口，不再充当上线公告、Demo 账号清单、验收记录或部署操作回执。

删除范围包括：开头的公网交付声明、整个“交付状态”、Demo 身份说明、公网部署 Runbook、部署 commit/project/region/date 以及逐项验收流水。已有 `docs/acceptance/` 与 `docs/deployment/` 文件不删除，只是不再占据 README 主叙事。

## Information Architecture

README 的核心阅读路径调整为：

1. 项目背景、目标读者、要解决的核心问题与范围边界。
2. 系统总体架构、模块职责、工程目录与数据权威。
3. 核心领域模型与视频归属证据链。
4. 完整视频采集业务流程：管理员、参与者、外部相机、平台、对象存储与复核者的正常路径和异常闭环。
5. 大文件上传与断点续传：协议原理、当前实现、状态机、失败恢复、安全设计和生产 Multipart 演进。
6. metadata、匹配、人工复核、审计、隐私与安全。
7. 精简的本地运行、数据库迁移与验证入口。
8. 当前能力边界与工程权衡，不包含交付状态或部署流水。

## Business Flow Contract

主流程按以下阶段描述：

`任务建模与发布 → Assignment 分配 → 参与者确认 → RecordingSession + Device → Session Marker → 外部设备录制 → 文件与 Session 手工绑定 → TUS 直传 → 对象大小对账 → metadata / MatchDecision / ReviewCase → 管理员接受、纠正、拒绝或要求重录 → AuditEvent 收口`

业务身份只由服务端权威关系产生：

- 登录身份确定 Participant。
- Assignment 固定 Participant 与不可变 TaskVersion。
- RecordingSession 固定 Assignment 与声明 Device。
- 上传前由参与者明确选择 Session，或选择 Unable to Determine 进入人工复核。
- 原文件名、拍摄 metadata、指纹和 Marker 都是辅助证据；它们不能覆盖服务端关系，也不能直接形成自动接受。

## Architecture Contract

- Admin Web：任务、参与者、分配、进度、复核和审计。
- Participant Web：任务确认、Session / Marker、文件选择、上传、暂停与恢复。
- `packages/core`：领域校验、状态机、服务、Auth、DB、Storage、metadata、match 与 audit。
- PostgreSQL：业务事实和审计的唯一权威。
- Supabase private Storage：视频对象字节；不以文件名表达业务关系。
- TUS 数据面：浏览器直接到 Storage；Next.js 仅发放短期、单对象授权并记录控制状态，不代理视频字节。

## Mermaid Diagram Set

README 至少包含以下 7 张互补图，避免把同一条链换皮重复：

1. **系统分层架构图（`flowchart LR`）**：Admin Web、Participant Web、共享核心、PostgreSQL、私有 Storage、metadata/reconcile 及未来 provider 边界。
2. **视频采集主流程图（`flowchart TD`）**：任务发布到接受，包含无法确认 Session、上传失败、匹配异常和要求重录等分支。
3. **管理员—参与者—外部相机—平台时序图（`sequenceDiagram`）**：突出录制发生在平台外、Marker 在录制开始时展示、文件在之后上传。
4. **身份匹配与证据链图（`flowchart LR`）**：Participant / Assignment / TaskVersion / Device / RecordingSession 到 VideoAsset / MatchDecision，区分权威关系与辅助证据。
5. **当前 TUS 断点续传时序图（`sequenceDiagram`）**：创建 Intent/Attempt、签发单对象授权、分片 PATCH、进度落库、暂停、刷新重选、HEAD/offset 恢复、Complete 对账。
6. **上传生命周期状态图（`stateDiagram-v2`）**：UploadIntent 与 UploadAttempt 的关键状态、失败/过期/新 Attempt 关系，以及“传输完成不等于业务接受”。
7. **生产级 S3 Multipart 演进图（`sequenceDiagram`）**：CreateMultipartUpload、分片授权、并行上传、ListParts、只补缺片、Complete/Abort；明确标注“未来方案”。

Mermaid 约束：

- 节点与消息使用中文，保留必要的实体名、协议名和 API 动词。
- 使用 GitHub 支持的基础语法，不依赖自定义脚本、远端图片或专有扩展。
- 每张图前有一句阅读目的，图后有一段事实边界，保证纯文本阅读与评审也能理解。
- 图内不放 URL、密钥、过长说明或易漂移的部署标识；精确参数放在表格和正文。

## Resumable Upload Contract

当前 TUS 采用“连续 offset”模型：Storage 记录该上传资源已经确认的连续字节位置，客户端恢复时找回相同 TUS URL，并从远端确认的 offset 继续 PATCH。文档需要对应解释：

- 6 MiB 切片降低单次失败成本；失败退避重试，不重传已经确认的前缀。
- 浏览器 v2 清单只负责找回上传上下文，远端 offset 才是传输进度权威。
- 浏览器安全模型要求刷新后由用户重新选择文件；完整 SHA-256、文件名和大小共同防止选错源文件。
- Pause 停止传输并保留 TUS 资源；Resume 从同一资源继续；Cancel 终止业务上传并清理本地恢复记录。
- `404/410` 或 Attempt 过期表示旧资源不可恢复，系统显式创建新的 UploadAttempt。
- Complete 不相信前端 100%，而是查询私有 Storage 的对象存在性和实际大小，再幂等登记 StoredObject、VideoAsset 与 MatchDecision。

未来 S3 Multipart 采用“离散 part 清单”模型：每个 part 有编号、checksum/ETag 和服务端回执，恢复时以 ListParts 为权威，只补缺片，最终幂等 CompleteMultipartUpload。该方案只作为生产演进说明，不能写成当前能力。

## Compatibility and Risk Controls

- 保留仍适合工程入口的本地命令和代码路径；公网 URL、Demo 账号、部署 receipt 和逐步云部署内容从 README 删除。
- 不使用外部相机文件名建立 object key 或业务身份。
- 不把二维码生成描述成二维码识别，不把 metadata 解析描述成任务内容自动验收。
- 不把 50 MB 小文件闭环扩张为 4K、多 GB、跨天、跨区域的生产证明。
- 文档改动可通过单独回退 README 提交恢复，不涉及数据库或运行时回滚。
