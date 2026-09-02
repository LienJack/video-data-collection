# Technical Design

## Library Decision and Dependency Boundary

选择稳定版 `xstate@5.32.6`；Participant 客户端上传队列使用 `@xstate/react@6.1.0`。不采用仍处于 alpha 的 XState v6 core，也不把 Stately Studio 作为运行时或交付依赖。

- `packages/core` 只依赖 framework-agnostic 的 `xstate`，不引入 React。
- `apps/participant-web` 在已有 Client Component 边界使用 `@xstate/react`；`apps/admin-web` 默认不引入 React adapter。
- 依赖精确锁定并由 lockfile 固化；升级必须经过状态图、数据库契约、TypeScript 与生产构建门禁。

## Core API

每个业务机器使用 XState v5 `setup(...)` 定义 stable id、typed states/events/context、initial/final、纯 guard 与命名 effect intent。机器位于其领域模块旁，不建立包含所有业务的巨型 actor system。

在 `packages/core/src/domain/state-machine.ts` 提供项目适配层：把数据库当前状态和已锁定事实解析成 XState snapshot，调用纯 `transition(machine, snapshot, event)`，再统一返回 next state、capabilities 与 effect intents。非法/未迁移事件转换为携带 machine/event/from 的稳定领域错误，由服务层映射为 DomainError code。

服务端不为数据库记录创建跨请求常驻 actor；XState 只解析迁移。现有 `participant.ts` 与 `assignment.ts` 的谓词迁移到机器能力封装，并保留兼容导出直到所有调用方迁移完成。

## Persistence Contract

新迁移建立 `egocapture.state_machine_transitions(machine, from_state, to_state)` 与通用更新触发器。每个受控表/列注册 machine id；同状态幂等写允许，其他更新只有在 registry 中存在边时允许。现有列值 `CHECK` 继续负责状态集合，registry 负责迁移边。

服务命令流程：

```text
lock/read current row
  -> machine.transition(current, event, context)
  -> UPDATE ... SET state = next WHERE id = ? AND state = current RETURNING ...
  -> no row means stale transition
  -> audit within same transaction
```

数据库 registry 与 XState 图 metadata 通过测试逐机比较。迁移文件保留固定快照；未来变更必须新增迁移并同步机器版本。PostgreSQL 始终是并发与持久化权威；Actor mailbox 不代替条件更新、行锁或事务。

## Compound Commands

- Session create/close、Assignment cancel/extend、Upload reconcile、Review resolution 仍由现有 service 拥有事务。
- 每个复合命令先锁定受影响行，再计算各机器事件；更新顺序在命令内固定。
- MatchDecision 继续使用 append-only supersede 机制，不改造成 mutable status。

## Client Upload Queue

建立一个 UploadQueue actor 和每个文件一个 UploadItem 子 actor。子 actor 接收 `fileSelected`、`hashSucceeded`、`startRequested`、`progressed`、`pauseRequested`、`resumeRequested`、`reconcileSucceeded`、`failed`、`abortRequested` 等事件；父 actor 管理批次、索引与最大文件数。

Hash/fetch/TUS 通过 Promise/callback actor 或可替换 effect adapter 接入，离开状态与组件卸载时必须 cleanup/abort。`File`、TUS client、AbortController 等运行时资源不得进入长期持久化 snapshot；刷新恢复继续使用有版本的最小 Upload DTO 和显式 rehydrate event。

## Error and i18n Boundary

机器错误只携带 code/parameters；中文、英文、日语文案由后续 i18n 任务在渲染边界选择。现有中文 DomainError message 暂保留为兼容 fallback，但测试不再依赖消息字符串。

## Migration and Rollback

- 先做 Participant 持久化机器和两文件上传队列的最小垂直切片；通过 TypeScript、聚焦单测、Participant production build 与客户端 chunk 增量检查后，再批量迁移其余机器。
- 垂直切片通过后加入 registry/trigger 与契约测试，再逐服务迁移写入口。
- 在触发器启用前扫描当前非 fixture 行是否存在未知状态；用户允许的数据清理发生在后续任务，不在本任务直接删除。
- 回滚代码时可保留 additive registry；如需禁用，只删除本迁移创建的表级触发器，不删除业务数据。
- 若垂直切片的类型、构建或客户端成本不可接受，停止扩散并回退到 typed kernel 方案；不得在 15 台机器铺开后再重新选型。
