# 原始需求追踪与偏差检查

## Source authority

- 方向性需求：仓库根目录 `需求.md`。
- 本次任务：重构管理员端全局采集记录交互，不替代整个 EgoCapture MVP 的产品、上传或部署需求。
- 判断原则：原始需求定义必须保留的用户能力；具体页面数量、路由和控件由本任务重新设计。

## Traceability matrix

| 原始需求 | 来源 | 当前系统/本方案 | 结论 |
| --- | --- | --- | --- |
| 参与者查看任务说明、录制指导和上传指导 | `需求.md:9-20,34-35,53-59` | 参与者端既有流程，本任务不修改 | 保持，不冲突 |
| 外部相机录制，文件可先落 SSD/相机存储后批量上传 | `需求.md:22-26,37-38,46` | 现有 Session + 手动 claimed Session；新工作台区分声明 Session 和最终 MatchDecision | 保持，需要补充延迟上传验收 |
| 追踪参与者、任务、设备和录制会话 | `需求.md:26,36,41` | 视频记录显示 participant/task/claimed or resolved session/device evidence | 符合，不能把 claim 误写成最终匹配 |
| 大文件可恢复上传及对象、Metadata 存储 | `需求.md:39-41,46,66` | 现有 TUS/Storage/Metadata 链路，本任务不修改 | 保持，不由本任务重新证明 |
| 管理员监控任务进度及缺失、失败、重复、未匹配和人工复核 | `需求.md:42,60-65` | 草案只有通用“待处理事项”；缺失上传没有 UploadIntent，不能出现在视频列表 | 草案缺口，改为显式异常分类入口 |
| 管理员查看录制会话、上传文件和 Metadata | `需求.md:63-64` | `/records` 的 Sessions/Videos 页签和既有上传详情 | 符合 |
| 全球参与者与多区域大文件能力 | `需求.md:43,46,66` | 当前 MVP 有生产演进说明；本任务只改管理端控制面 | 不冲突，但不得声称本任务已完成生产能力 |
| 隐私、安全、访问控制和可审计性 | `需求.md:44` | requireAdmin、私有预览、只读 AuditEvent、不变 Trigger 均保留 | 符合 |
| 公网可访问 MVP 和 Public URL | `需求.md:48-52` | 本任务不部署；当前仍需单独的云部署验收 | 未被本任务关闭，必须明确保留外部交付状态 |
| 评价产品流程、数据模型、失败场景和技术权衡 | `需求.md:68-70` | 合并页面但保留 claim/resolution、异常分类和审计证据 | 符合，且比三个实体页面更易演示 |

## Required plan corrections

### 1. Make all required failure classes visible

“采集记录”顶部增加异常概览，至少明确显示：

- 缺少上传
- 上传失败
- Metadata 失败
- 重复候选
- 尚未匹配
- 设备不一致/需要人工处理

缺少上传是 Assignment 层状态，链接到现有缺失参与者/任务视图；其他视频异常链接到带 `caseType` 的 Review 队列。不得制造一条假的 Upload 记录来表达 missing。

### 2. Preserve delayed batch-upload matching

Sessions 页签可以默认显示 open，但必须提供清晰的“全部历史/已关闭”切换，搜索必须覆盖已关闭 Session。视频记录区分：

- 参与者上传时声明的 Session。
- 当前不可变 MatchDecision 解析出的最终 Session。
- 无法确定或已拒绝的匹配。

这保证数小时或数天后上传时仍能追溯录制上下文。

### 3. Keep original delivery gaps honest

本任务验收只能证明管理端交互重构，不证明：

- 公网 URL 已部署。
- 云 Supabase/Vercel 已验收。
- 真实多 GB、跨区域、跨天上传已达到生产 SLA。

这些仍需独立部署和生产架构验收。

## Scope-pruning decision

原始需求不要求复杂审计检索。第一阶段 Activity 页签只实现关键词和动作分类；按操作者、任意时间范围等高级筛选延后。优先完成异常可见性、晚到上传追溯和一跳处理闭环。
