# 编写中文项目架构与视频采集上传 README

## Goal

依据仓库根目录《需求.md》和当前实现，重写根目录中文 README，使工程师与项目 Leader 能够准确理解 EgoCapture 的项目架构、领域模型、视频采集业务全流程，以及大文件分片与断点续传的实现原理。

## Confirmed Facts

- 《需求.md》要求交付一份简短 README，解释产品流程、架构、权衡和本地运行方式，并明确说明生产环境如何支持大型可恢复上传。
- 当前 README 混入了公网地址、部署提交、Demo 账号、地区、验收日期和部署 Runbook 等交付汇报信息。用户明确要求删除这些内容，把项目入口文档重心转向架构、业务流程和大型文件上传细节。
- 当前实现由独立的 Admin Web 与 Participant Web、共享 `packages/core` / `packages/ui`、PostgreSQL 和私有 Supabase Storage 组成。PostgreSQL 是业务与审计权威，Storage 只保存对象字节。
- 当前业务链为 `Participant → Assignment → TaskVersion → Device → RecordingSession → UploadIntent / UploadAttempt → StoredObject → VideoAsset → MatchDecision → ReviewCase / AuditEvent`。
- 参与者在外部设备录制，上传时手动选择 Recording Session；Participant、TaskVersion、Device 和 object key 由服务端根据登录身份、Assignment 与 Session 推导，不依赖摄像机默认文件名。
- 当前 MVP 使用 `tus-js-client` 将视频从浏览器以固定 6 MiB 分片直传私有 Storage。MVP 限制为单文件 50,000,000 bytes、每批最多 5 个文件。
- 浏览器保存 v2 恢复记录和 TUS 资源引用；恢复前重新选择原文件，并校验文件名、大小和完整 SHA-256。服务端单调记录 `bytes_uploaded`，Complete 通过 Storage 对象存在性与实际大小完成对账。
- 当前上传资源与短期授权都有有效期；资源返回 `404/410` 或服务端 Attempt 过期时创建新的 UploadAttempt，不能把旧进度静默冒充为新资源。
- 数 GB、跨天、跨区域上传尚未交付。仓库只预留 Multipart 数据模型，生产演进应使用 S3 Multipart、IndexedDB、服务端 ListParts/ETag 权威、幂等 Complete 与过期 Abort。

## Requirements

- R1：README 必须用中文说明系统定位、目标读者、业务角色、核心问题和能力边界，主要面向工程师与项目 Leader。
- R2：README 必须使用 Mermaid 架构图说明双应用、共享包、控制面、视频数据面、PostgreSQL 与私有对象存储的职责边界。
- R3：README 必须使用 Mermaid 业务流程图与跨角色时序图，按业务顺序说明管理员发布任务、分配参与者、参与者确认任务、创建 Session、展示 Marker、外部录制、批量选择文件、直传、对象对账、metadata、匹配、人工复核和审计收口。
- R4：README 必须使用 Mermaid 关系/流程图具体解释批量上传时如何通过 Assignment / RecordingSession / 手工选择建立视频归属，以及为何文件名、metadata 和二维码都只能作为证据。
- R5：README 必须从“切片、远端 offset、浏览器恢复记录、文件身份校验、暂停/恢复、重试、过期、新 Attempt、Complete 对账”解释当前 TUS 断点续传原理，并配套 Mermaid 上传时序图与状态图。
- R6：README 必须使用 Mermaid 图或明确对比说明当前 TUS 与生产级 Multipart 演进，禁止暗示 MVP 已支持数 GB、跨天或全球弱网生产上传。
- R7：删除开头的公网交付声明及整个“交付状态”章节；删除 Public URL、部署 commit、Demo 账号、Supabase project/region、部署日期、公网部署 Runbook 和验收流水等与目标读者无关的信息。
- R8：将本地/NAS 启动、Migration、Seed 和测试命令压缩成工程师可执行的最小入口；保留隐私、安全、失败处理和能力边界，但不保留交付证明口吻。
- R9：补充核心领域对象及关键状态的说明，使项目 Leader 能看懂流程责任、异常去向与完成定义，使工程师能找到对应代码和数据权威。
- R10：关键英文缩写首次出现时给出中文解释或足够上下文，文档结构便于从目录快速定位。

## Acceptance Criteria

- AC1（R1、R2）：根目录 README 含清晰的项目定位、角色说明、工程目录、一张 Mermaid 系统架构图及各层职责。
- AC2（R3）：README 含独立的“视频采集业务流程”章节，并用一张 Mermaid 流程图和一张 Mermaid 时序图覆盖管理员、参与者、外部相机、系统与对象存储从准备到最终接受的正常路径和异常回路。
- AC3（R4）：README 用一张 Mermaid 身份匹配/证据链图说明外部相机或 SSD 批量上传的归属建立方式，并写明手动 Session 选择是当前 MVP，二维码自动识别不是当前能力。
- AC4（R5）：README 含一张 Mermaid TUS 断点续传时序图和一张 Mermaid 上传状态图，读者可以据此回答暂停、刷新、断网、重试、资源过期和完成确认分别如何处理。
- AC5（R6）：README 用一张 Mermaid 生产级 Multipart 演进图及对比表区分当前 TUS 与未来方案，不把设计方案写成已验证能力。
- AC6：README 合计至少包含 7 张职责互不重复、可在 GitHub Markdown 中渲染的 Mermaid 图，图下文字解释“图表达的事实”和“不能据此推导的能力”。
- AC7（R7）：README 不再包含“交付状态”、公网验收声明、Demo 凭据/身份、部署 commit、具体云项目标识、部署日期或公网部署 Runbook。
- AC8（R8、R9、R10）：README 保留简洁可执行的本地启动/验证入口，并包含领域对象、状态、失败处理、安全与能力边界；命令、路径、组件和限制均可从当前仓库找到依据。
- AC9：内部 Markdown 链接有效，Mermaid 语法检查与 `git diff --check` 通过。
- AC10：提交只包含 `README.md` 与本任务必要的 Trellis 记录，不包含现有参与者管理、任务详情或样式改动。

## Out of Scope

- 不修改业务代码、数据库结构、上传协议或产品交互。
- 不补做公网部署，也不把本地或小文件验证等同于生产级多 GB 上传证明。
- 不实现二维码识别、自动视频分类、逐帧内容理解、恶意文件扫描、代理视频生成或直播。
- 不在 README 中承担验收报告、部署回执、Demo 账号清单或逐步云部署 Runbook 的职责；这些历史资料如仍需保留，应留在 `docs/acceptance/` 与 `docs/deployment/`。
