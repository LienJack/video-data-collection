# 统一业务状态机

## Goal

把散落在 SQL、服务函数和 UI 条件中的生命周期规则收敛为显式、可测试、并发安全的状态机，使任何状态变化都能回答“当前状态、触发事件、允许目标、守卫条件、审计结果”。

## Background

- `Participant` 已有局部 TypeScript 迁移表；`Assignment` 只有若干特定动作谓词，其余实体主要依赖内联判断和直接 SQL 更新。
- 数据库有状态值 `CHECK`，但大多数表没有“旧状态到新状态”的迁移约束。
- 服务层包含跨实体联动，例如 Upload 验证推动 Assignment 提交、Review 决策同时更新 Asset/Assignment/Session/ReviewCase。
- 当前数据允许清理，因此不需要为脏状态设计兼容旁路；迁移仍必须能安全应用于本地和新云项目。
- 状态机库调研决定采用稳定版 XState v5：领域层使用 framework-agnostic core，Participant 上传队列使用 React adapter；不采用 XState v6 alpha、Robot3、Redux 或自研运行时。

## Requirements

### Persistent machines

- 为以下字段建立命名状态机：Participant、Consent projection、Invitation、Consent record outcome、Device、Task lifecycle、Assignment、RecordingSession、UploadBatch、UploadIntent transfer、UploadIntent metadata、UploadAttempt、VideoAsset、MetadataAttempt、ReviewCase。
- 每台状态机定义稳定状态键、事件、允许迁移、初始状态、终态和必要守卫。
- 追加型 `consent_records.status` 作为不可变结果模型：创建后不能原地改变；新 Consent 事件驱动 Participant consent projection 状态机。

### Runtime enforcement

- 使用 XState v5 `setup(...)` 定义 typed state/event/context/guard；持久化机器在请求内通过纯 transition API 计算下一状态，不在 Serverless 请求之间保存常驻 actor。
- 所有产品服务写入必须先通过共享状态机按“事件 + 当前状态”解析目标，再使用带旧状态条件的原子 SQL 更新。
- 跨实体动作在一个数据库事务内按状态机验证并写入，任何一步失败必须整体回滚。
- 非法或竞争失败返回稳定 DomainError code，不依赖中文消息判断。
- 合法业务迁移继续写 AuditEvent；幂等重放返回已有结果，不重复产生副作用。

### Database enforcement

- 新增可审计的数据库迁移守卫，阻止服务旁路或脚本执行非法旧状态→新状态更新。
- TypeScript 与数据库迁移图必须由集成测试验证一致；不得维护两套未经校验的事实。
- Seed 通过插入合法快照构建展示场景；演示恢复通过清理后重建，不通过非法逆向迁移。

### Client workflow

- Participant upload queue 使用 XState actor，统一 hashing、ready、preparing、uploading、paused、reconciling、verified、failed、aborted 等瞬时状态；队列拥有动态文件子 actor，并显式处理异步 cleanup、取消和 stale callback。
- UI 按机器能力渲染按钮；不再用散落的 `status === ...` 组合决定可执行动作。

### Derived classifications

- ParticipantCredentialStatus、device consistency、capture-time confidence、HTTP 状态及指南标签保持纯派生分类，不创建虚假迁移 API。
- 派生分类必须有穷尽类型测试和单一计算函数。

## Acceptance Criteria

- [x] 每个持久化机器和上传队列机器都有图/表定义及允许、拒绝、终态测试。
- [x] 所有产品代码中的生命周期 UPDATE 都由机器事件驱动，并使用原子旧状态条件或等价事务锁保护。
- [x] 数据库拒绝至少一个直接非法迁移，契约测试确认数据库与 TypeScript 图一致。
- [x] 并发/重复命令测试证明只有一个迁移生效，审计和副作用不重复。
- [x] Upload、Review、Session、Participant、Task 集成检查和现有主流程 E2E 通过。
- [x] 状态键保持兼容；API 以稳定错误码暴露非法迁移。

## Out of Scope

- 引入外部工作流引擎、消息队列或事件溯源框架。
- 把纯显示分类、HTTP code 或不可变 MatchDecision 类型强行建成可迁移状态机。
- 更改现有业务链的产品含义或扩大上传协议范围。
