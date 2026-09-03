# README 事实依据

## 需求来源

- `需求.md`：README 需解释产品流程、架构、权衡、本地运行方式，以及生产环境的大型可恢复上传方案。

## 架构与业务流程

- `apps/admin-web/app/**`：管理员管理任务、参与者、分配、会话、上传、复核和审计。
- `apps/participant-web/app/**`：参与者确认任务、创建 RecordingSession、展示 Marker、选择文件并上传。
- `packages/core/src/server/services/**`：领域服务、数据库、Storage、metadata、match、review 和 audit。
- `database/migrations/0001_core.sql`：核心实体与基础约束。
- `database/migrations/0002_rls_and_views.sql`：RLS 与读取视图。
- `database/migrations/0009_match_decision_supersede.sql`：不可覆盖的 MatchDecision 纠正链。
- `database/migrations/0013_multipart_evolution_reservation.sql`：未来 Multipart 数据模型预留，不能描述成已实现能力。

## 当前 TUS 实现

- `packages/core/src/domain/constants.ts`：单文件 50,000,000 bytes、每批 5 个、TUS 分片 6 MiB。
- `packages/core/src/upload/fingerprint.worker.ts`：计算首尾 1 MiB 指纹与完整文件 SHA-256。
- `packages/core/src/upload/persistence.ts`：浏览器 v2 恢复清单、状态、已确认字节和 Attempt 到期信息。
- `packages/core/src/upload/tus.ts`：`tus-js-client`、退避重试、单对象授权、资源恢复及 `404/410` 过期识别。
- `apps/participant-web/app/(portal)/uploads/upload-queue.tsx`：重新选择原文件、暂停、恢复、新 Attempt、取消、进度上报和 Complete 调用。
- `packages/core/src/server/services/uploads.ts`：UploadIntent/UploadAttempt、2 小时授权、24 小时 Attempt、单调进度、对象存在/大小对账、幂等完成与业务对象登记。

## 边界

- 当前 MVP 采用 TUS 连续 offset 模型并受 50 MB 限制。
- 数 GB、跨天和跨区域弱网上传尚未验证；生产方案采用 S3 Multipart、IndexedDB、ListParts/checksum/ETag、幂等 Complete 与过期 Abort。
- Marker 当前只生成和展示；不自动从视频画面识别。
- metadata 只做有限 Range 读取和轻量解析；不进行逐帧内容判断。
