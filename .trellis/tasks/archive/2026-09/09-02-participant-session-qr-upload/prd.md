# 参与者会话二维码与上传入口

## Goal

让参与者在任务详情页直接看到每个 Recording Session 的签名二维码，并能从该 Session 的上下文进入视频上传，避免上传文件时丢失或选错 Session 归属。

## Background

- 任务详情页当前只显示可点击的 Session 文本卡片，包含 Session ID、状态、设备和 Marker 确认状态：`apps/participant-web/app/(portal)/tasks/[assignmentPublicId]/page.tsx:89`。
- 独立 Session 页面已经通过 `getMarker` 读取并展示签名二维码，因此本任务复用现有二维码数据，不新增二维码协议或识别逻辑：`apps/participant-web/app/(portal)/sessions/[sessionPublicId]/page.tsx:14-28`。
- `/uploads` 当前列出参与者的全部 open Session；用户选中文件后，需要为每个文件手动选择 Recording Session：`apps/participant-web/app/(portal)/uploads/page.tsx:9-29`、`apps/participant-web/app/(portal)/uploads/upload-queue.tsx:543-560`。
- 上传客户端把选择结果作为 `claimedSessionPublicId` 创建 UploadIntent：`apps/participant-web/app/(portal)/uploads/upload-queue.tsx:293-315`。
- 服务端只接受当前参与者拥有且状态为 open 的 Session，并把其内部 ID 写入 `upload_intents.claimed_session_id`：`packages/core/src/server/services/uploads.ts:248-290`。

## Requirements

- R1. 将任务详情页的 `Recording Sessions` 标题改为中文“展示二维码”。
- R2. 每个 Session 模块直接展示该 Session 的现有签名二维码，同时保留足以识别 Session 的 ID、状态和设备信息。
- R3. 每个二维码下方提供明确的“上传视频”按钮。
- R4. 从某个 Session 的按钮进入上传页时，必须携带该 Session 的 Public ID；上传页只接受当前登录参与者拥有的 open Session 作为入口上下文。
- R5. 入口携带的 Session 必须成为新选择视频的锁定归属，不允许在上传页切换为其他 Session 或 `Unable to Determine`；绑定继续通过现有 `claimedSessionPublicId -> claimed_session_id` 服务端校验与持久化链路完成。
- R6. 直接访问通用 `/uploads` 时，保留现有手动选择 Session 或 `Unable to Determine` 的流程。
- R7. 不改变二维码签名内容、二维码识别策略、TUS 传输链路、数据库结构或后台人工纠错流程。

## Acceptance Criteria

- [x] AC1. 存在 Session 时，任务详情页显示“展示二维码”，不再显示 `Recording Sessions`。
- [x] AC2. 每个 Session 模块可见对应签名二维码，二维码的替代文本能标识 Session。
- [x] AC3. 每个二维码下方可见“上传视频”按钮。
- [x] AC4. 点击某个 Session 的“上传视频”后进入上传页，并明确显示当前绑定的 Session。
- [x] AC5. 从该入口选择视频后，Session 不可切换，创建 UploadIntent 的请求携带该 Session 的 `claimedSessionPublicId`。
- [x] AC6. 无效、已关闭或不属于当前参与者的 Session 不能通过入口参数绕过服务端权限与状态校验。
- [x] AC7. 通用 `/uploads` 的手动选择和 `Unable to Determine` 回退仍可用。
- [x] AC8. 针对页面渲染、Session 预选/绑定及现有上传契约的自动化检查通过。

## Out of Scope

- 扫描视频画面中的二维码并自动识别 Session。
- 根据文件名、Metadata 或二维码内容自动分类视频。
- 新增数据库字段或改变 `UploadIntent`、`UploadAttempt`、TUS Storage 关系。
- 重做独立 Session Marker 页面。

## Key Decisions

- 从 Session 卡片进入上传页后锁定该 Session，优先防止误绑；需要选择其他 Session 时，参与者应返回对应 Session 卡片重新进入。
- 直接访问通用 `/uploads` 时不锁定 Session，继续支持手动选择及 `Unable to Determine` 回退。
