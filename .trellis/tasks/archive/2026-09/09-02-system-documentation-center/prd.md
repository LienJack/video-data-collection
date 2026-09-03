# 系统说明文档中心

## Goal

在 EgoCapture Admin Web 内提供一个可直接访问的中文“系统说明”入口，让管理员或演示者能够在网页中理解现有双端系统、管理员与参与者的协作流程，以及大型文件上传与未来直播采集的演进方案。

## Background and Confirmed Facts

- 产品由 `apps/admin-web` 与 `apps/participant-web` 两套 Next.js 应用组成，并共享 `packages/core` 与 `packages/ui`。
- 当前权威业务链为 `Participant -> Assignment -> immutable TaskVersion -> Device -> RecordingSession -> UploadIntent/UploadAttempt -> StoredObject -> VideoAsset -> ValidationRun -> MatchDecision -> ReviewCase/AuditEvent`。
- 当前 MVP 使用浏览器 TUS 直传私有对象存储，视频字节不经过 Vercel Function；生产级跨天、不可重复上传的长期方案需要单独说明 Multipart 演进边界。
- 本需求是产品内说明页面，不将“未来方案”描述为已经上线的能力。
- 用户要求优先使用 Archify 制作更美观的架构图与流程图；必要时可以使用 Mermaid。

## Requirements

### R1. 产品入口与文档阅读体验

- 仅在 Admin Web 的产品顶部区域增加“系统说明”入口，推荐放在右上角，并沿用现有视觉语言、响应式行为与键盘可访问性。
- 点击入口进入受现有 Admin 登录保护的 `/system-guide` 页面，而不是下载独立文件。
- 文档应提供清晰的文章目录、当前文章定位，以及桌面和移动端均可阅读的正文版式。
- 四篇文章在同一页面以语义化 article 与锚点呈现，支持直接链接到具体文章。
- 页面内容为中文；协议、产品名、代码标识符可保留英文。
- Participant Web 不增加说明入口，也不暴露面向管理员/演示者的内部技术演进内容。

### R2. 文章一：整个系统的架构

- 基于仓库真实实现说明 Admin Web、Participant Web、共享核心包、数据库/认证/对象存储、上传与后台处理边界。
- 至少包含一张经过 Archify 验证的系统架构图。
- 明确“当前已实现”与“未来演进”边界，避免把公网部署或直播能力写成既有事实。

### R3. 文章二：整个系统的流程

- 说明管理员与参与者两套系统如何联动，覆盖任务创建/发布、参与者分配、Recording Session、上传、处理、审核与审计闭环。
- 至少包含一张时序图或等价的 Archify sequence 图；参与者、Participant Web、Admin Web、控制面与对象存储的交互方向必须清楚。

### R4. 文章三：大型文件断点上传方案

- 先准确解释当前 TUS 直传实现、指纹/持久化/恢复机制与已知限制。
- 再以独立“后续可采用方案”介绍面向生产级大文件、跨天恢复和多云对象存储的 Multipart 上传设计。
- 至少覆盖 Upload Session、分片并发、幂等、校验、断点恢复、过期清理、完成合并、安全边界与失败恢复。
- 包含一张经过 Archify 验证的断点续传 sequence 图，展示初始化、分片上传、暂停/恢复、补签、完成与服务端核验。
- 研究内容是方案参考，不要求在本任务实现新的上传协议。

### R5. 文章四：直播推流与管理端保存方案

- 以未来方案形式说明参与者采集端如何推流、直播服务如何接入、管理端如何查看状态，以及录制视频如何落入对象存储并回填控制面。
- 采用供应商可替换的适配器边界，并以 AWS IVS Web Broadcast/RTMPS + Auto-record to S3 作为具体参考路径；Cloudflare Stream/Mux 仅作可替换候选。
- 至少覆盖推流协议/适配、鉴权、转码或转封装、服务端录制、切片/归档、回调幂等、失败恢复、回看与权限审计。
- 包含一张经过 Archify 验证的直播采集 sequence 图，展示参与者推流、平台录制、对象存储归档、事件回调与管理端回看。
- 不在本任务实现真实直播推流或视频录制后端。

### R6. 图表交付

- Archify 图表使用中文主语言与 `zh-CN` Viewer UI，采用 `showcase` 质量档。
- 图表源规格与最终 HTML 均纳入仓库，且通过 Archify `validate`、`deliver` 与浏览器 `visual-check`。
- 产品正文应能稳定展示图表；如嵌入交互式 HTML 带来安全或路由约束，可使用经过验证的静态导出并提供打开交互图的入口。

## Acceptance Criteria

- [ ] AC1：Admin 用户可以从既有产品顶部区域进入“系统说明”，刷新或直接访问 `/system-guide` 仍受登录保护并正常工作；Participant Web 不出现该入口。
- [ ] AC2：说明中心在同一页面包含四篇可锚点直达的独立文章，目录、标题、正文层级、代码/协议名和移动端排版清晰可读。
- [ ] AC3：系统架构文章与仓库现有双应用、共享包、控制面/数据面事实一致，并含通过 Archify 验证的架构图。
- [ ] AC4：系统流程文章清楚展示 Admin 与 Participant 的联动及端到端闭环，并含通过 Archify 验证的 sequence 图。
- [ ] AC5：大型文件上传文章将当前 TUS 实现与未来 Multipart 方案分开陈述，并用 sequence 图解释断点恢复，不声称未实现能力已上线。
- [ ] AC6：直播文章以未来方案和 sequence 图呈现参与者推流、管理端状态与服务端录制归档闭环，不实现直播运行时。
- [ ] AC7：四张图表通过 Archify showcase 校验、确定性交付和桌面浏览器检查；视觉检查状态如实记录。
- [ ] AC8：相关 lint、TypeScript、测试与生产构建通过，且不回退现有 Admin/Participant 主流程。
- [ ] AC9：提交仅包含本任务拥有的文件，不纳入工作区中其他未提交 Trellis 任务或 `需求.md`。

## Out of Scope

- 实现 S3 Multipart 或替换现有 TUS 上传运行时。
- 实现 WebRTC/RTMP/SRT 推流、云直播供应商接入、转码、录制或回放服务。
- 扩展二维码识别、自动 Session 分类、重型媒体检测或代理视频生成。
- 把本地验证描述为公网部署或生产容量证明。
- 在 Participant Web 增加“系统说明”入口或复制说明页面。
