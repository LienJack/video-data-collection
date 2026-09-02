# 仓库与读者证据

日期：2026-09-02

## 当前页面问题

- `apps/admin-web/app/(console)/system-guide/system-workflow-article.tsx` 的标题符合用户问题，但摘要、结论和六个步骤直接使用 Assignment、TaskVersion、Recording Session、UploadIntent、StoredObject、ValidationRun、MatchDecision、ReviewCase、AuditEvent 等内部名词。读者需要先理解实现模型，才能回答“管理员与参与者如何完成一次采集”。
- 同一文章末尾的依据列表全部指向 migration 与 service 文件，进一步把阅读重心带向代码和数据库，而不是业务责任、交接和完成标准。
- `docs/system-guide/diagrams/system-workflow.sequence.json` 以 Admin Web、Participant Web、Control Plane、PostgreSQL、Storage 为参与者，主要表达技术调用链，而不是两个业务角色的一次采集旅程。
- `apps/admin-web/app/(console)/system-guide/resumable-upload-article.tsx` 已正确区分当前 TUS 与未来 Multipart，但主要以 fingerprint、localStorage、uploadId、ListParts、ETag、checksum 等机制组织内容；它缺少一个从“选择 10 GB 文件”到“刷新后继续”的连续用户故事和异常决策表。
- 页面桌面截图显示当前视觉骨架、目录和当前/未来标签可复用。本任务无需重做整个说明中心，只需重构第 02、03 章及其图。

## 当前已验证能力

来源：`docs/acceptance/2026-09-02-local-mvp.md`、当前上传客户端和测试。

- 浏览器使用 TUS 把视频字节直接传向 Storage Gateway，不经过 Next.js 请求体。
- 真实本地验收使用超过 6 MiB 的 MP4 和 6 MiB chunk，覆盖多分片、首片后暂停、`findPreviousUploads()` 找回资源、继续上传和幂等完成。
- 当前浏览器保存可恢复上传清单；重新选择文件时会核对完整 source SHA-256、文件名和大小，找回同一上传业务记录。
- TUS 服务端记录的 offset 是已确认进度；页面上的本地百分比不是恢复权威。
- 当前单文件上限为 50,000,000 bytes，但验收没有证明 50 MB 边界吞吐，更没有证明数 GB、4K、跨天或跨地区上传。
- TUS 资源返回 404/410 或浏览器中的 TUS 地址丢失时，当前实现不会在旧尝试下静默从零开始；用户需要显式创建新的尝试，并保留失败历史。

## 当前完整业务闭环

来源：`docs/acceptance/2026-09-02-local-mvp.md` 的 Chromium 完整链路。

1. 管理员创建参与者、准备并发布采集任务、把任务分配给参与者。
2. 参与者登录，阅读并确认本次固定的采集要求。
3. 参与者创建一次采集会话，确认设备和现场标记，再使用外部设备录制。
4. 参与者回到上传页，选择对应的采集会话和视频文件，完成 TUS 直传。
5. 系统核对文件是否完整到达、提取轻量媒体信息，并给出匹配或异常状态。
6. 管理员查看证据、处理异常、确认或纠正归属；通过后本次采集才完成。

## 设计边界

- `docs/acceptance/2026-09-02-local-mvp.md` 明确：S3 Multipart 只有演进预留，没有运行实现；没有数 GB、跨天或跨地区压力验证。
- 研究答案明确：当前 TUS 适合 MVP 的弱网、暂停和刷新恢复演示；生产要求跨天且不重传已成功分片时，演进到持久化 Multipart 上传会话。
- 研究目录是设计参考，不替代当前用户需求；页面必须把未来方案标记为设计，而不是现状。
- QR/Marker 由当前 Session 产生，但上传仍由参与者手动选择 Session；二维码自动识别与自动分类继续保持范围外。

## 对本任务的直接结论

- 第 02 章改成“管理员准备与发起 → 参与者理解与录制 → 参与者上传 → 系统核验 → 管理员处置 → 完成/重录”的业务主路径。
- 内部技术名词降级为折叠后的“实现提示”或完全移除；正文使用“任务版本固定”“一次采集会话”“上传记录”“系统核验”“人工复核”等自然语言。
- 第 03 章同时回答当前怎么做和未来怎么做，但核心从协议名转为用户可观察行为、恢复条件和失败结果。
- “上传 100%”只代表字节传输完成；“一次采集完成”必须等系统核验与管理员处置闭环结束。
