# 可信演示数据

## Goal

安全删除当前 EgoCapture 脏业务数据，并生成一套跨中国、美国、日本、覆盖核心状态与页面、可重复恢复的可信演示数据。

## Background

- 用户明确授权删除当前全部业务数据。
- 现有 seed 只有一个 `Participant Demo`、`Demo Region`、`Synthetic Demo Phone`，展示真实性不足。
- 现有 `db:reset:task-v2` 只清理 Task/Upload 子图，明确保留 Participant、Consent、Device 和 Profile，不满足全量清理要求。
- 新状态机禁止 fixture 通过非法逆向更新恢复，因此演示恢复必须清理后按合法快照重建。

## Requirements

### Safe reset

- 新命令默认只打印目标身份、表计数、Auth 用户数和 Storage 对象数；必须同时提供 `--execute` 与精确环境 id 才执行。
- 只允许清理经 `EGOCAPTURE_ENVIRONMENT_ID` 标识的本地/NAS EgoCapture 环境或本任务创建的专用云项目；拒绝未知、生产共享或现有 Text2SQL 项目。
- 清理所有 EgoCapture 业务表、关联 Auth 用户和 `egocapture-raw` bucket 对象；保留 schema migrations、bucket 配置和基础角色/策略。
- 每阶段失败可安全重跑，并在结束后验证业务表、Auth 和 Storage 均无旧数据。

### Fixture catalog

- 使用人工审阅的确定性目录，不依赖随机在线数据源；参考 Mock/Faker 的 factory 思路，但实体 identity、public id 和场景固定。
- 至少 18 名参与者：中国、美国、日本各 6 名；使用各地区常见且自然的虚构姓名组合、真实 ISO country code、合适 locale/timezone。
- 至少 3 个可登录 Participant（中/英/日各一个）和一个 Demo Admin；凭据来自环境变量，不写入仓库。
- 设备使用真实常见品牌/型号组合，但序列号只存 HMAC/空值；不得暗示设备或人物是真实采集对象。
- Task instructions 按参与者语言提供自然示例；用户创作内容不随 UI locale 自动翻译。

### Scenario coverage

- 覆盖 draft/invited/active/suspended/withdrawn 等参与者展示、有效/过期 Consent、active/lost/retired/shared Device。
- 覆盖 Task draft/active/archived、Assignment 主要阶段、open/closed Session、上传成功/失败/暂停/过期、metadata 成功/失败、Review open/resolved/dismissed 和 accepted/rework/missing 等场景。
- 至少有一个完整健康链、一个待审核链、一个缺失上传链、一个设备不匹配链和一个失败重试链。
- 不提交大型媒体；展示记录如无真实对象必须显式标记 fixture，公网烟雾测试另行创建一个真实小对象。

### Determinism

- UUID/public id、人物目录、任务内容、状态分布固定；时间以一个 seed anchor 计算相对 chronology，同一 anchor 重跑结果一致。
- Upsert 不得把已被真实数据占用的 fixture identity 静默覆盖；发生冲突必须 HOLD。

## Acceptance Criteria

- [ ] Dry-run 不修改数据，并显示精确目标和清理规模；错误环境 id 无法执行。
- [ ] 经授权执行后旧业务表、关联 Auth 和 Storage 对象全部清空，再播种成功。
- [ ] Seed 生成至少 18 个自然可信参与者及中/英/日三套可登录演示路径。
- [ ] 数据完整性检查覆盖 FK、状态机合法快照、当前 MatchDecision 唯一性、凭据隔离和 RLS。
- [ ] 使用同一 anchor 连续执行 refresh 两次，实体 identity、数量、状态和关键内容一致。
- [ ] Admin/Participant 页面不再出现 `Participant Demo`、`Demo Region`、`Synthetic Demo Phone` 等占位数据。
- [ ] `pnpm db:test:seed`、聚焦 E2E 和 repo safety 通过。

## Out of Scope

- 导入真实个人身份、邮箱、电话、真实设备序列号或真实采集视频。
- 生成统计意义上的大规模压测数据。
- 修改现有无关 Supabase 项目中的任何数据。
