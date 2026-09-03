# Implement：中文项目架构与视频采集上传 README

## Removal Checklist

- [x] 删除开头的 NAS/Vercel/Supabase 公网交付声明。
- [x] 删除整个“交付状态”章节及 Demo 凭据、Public URL、部署 commit/project/region/date。
- [x] 删除“公网部署 Runbook”和以验收日期、固定提交为中心的证明流水。
- [x] 精简 NAS 拓扑、Migration、Seed 和测试内容，只保留工程师运行与验证项目所需入口。

## Documentation Checklist

- [x] 重写开篇和目录，突出架构、领域模型、业务流程、断点续传、生产演进和本地运行入口。
- [x] 在“架构与数据权威”中加入 Mermaid 系统分层架构图，明确应用层、共享领域层、控制面、视频数据面和持久化层职责。
- [x] 新增“视频采集业务流程”章节，加入 Mermaid 主流程图与跨角色时序图，覆盖正常主链和异常闭环。
- [x] 新增 Mermaid 身份匹配与证据链图，解释外部相机/SSD 批量文件为何不依赖默认文件名。
- [x] 重构“TUS 直传、暂停与恢复”章节，加入 Mermaid 断点续传时序图与上传生命周期状态图，再映射到当前代码和状态模型。
- [x] 在“生产演进”中加入 Mermaid S3 Multipart 时序图与当前/未来对比表，明确两种恢复模型和证据边界。
- [x] 为每张 Mermaid 图补充阅读目的和事实边界，避免图示暗示未实现能力。
- [x] 补充核心对象、关键状态、失败场景、安全边界和架构权衡的工程说明。
- [x] 通读 README，消除交付汇报口吻、重复、矛盾或过度承诺的旧表述。

## Validation

- [x] `rg -n '^#{1,4} ' README.md`：检查章节层级和可定位性。
- [x] 统计 Mermaid 代码块不少于 7 个，并人工检查 `flowchart`、`sequenceDiagram`、`stateDiagram-v2` 的语法和职责无重复。
- [x] 用 `rg` 确认 README 不再包含“交付状态”、Public URL、Demo 账号、部署 commit/project/region/date 或公网部署 Runbook。
- [x] 用仓库搜索逐项核对 6 MiB、50 MB、5 文件、2 小时授权、24 小时 Attempt、SHA-256、`404/410`、幂等 Complete 等技术事实。
- [x] 检查 README 中所有相对 Markdown 链接的目标是否存在。
- [x] `git diff --check -- README.md .trellis/tasks/09-03-chinese-readme`。
- [x] `pnpm repo:safety`，确认文档未引入秘密或大文件。
- [x] 检查 `git diff --name-only` 和暂存清单；工作提交仅纳入 README，Trellis 任务记录交由归档提交处理。

## Verification Results

- Mermaid CLI `11.17.0` 从 README 成功渲染 8 张图。
- `pnpm repo:safety` 通过。
- `pnpm check` 通过：ESLint、TypeScript、37 个 Vitest 文件 / 164 个测试，以及 Participant/Admin production build 全部成功。
- README 禁删内容、相对链接、上传参数和 `git diff --check` 专项检查通过。

## Rollback and Commit Boundary

- README 是唯一产品交付文件；发现事实错误时直接回退本任务对 README 的对应段落。
- 不修改或暂存工作树中现有的 Admin UI、测试和其他 Trellis 任务文件。
- 完成 Trellis 检查和记录后创建一个范围化文档提交。
