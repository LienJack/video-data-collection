# EgoCapture 状态机库选型调研

> 调研时间：2026-09-02
> 资料边界：仅使用官方文档、官方仓库/源码、npm 官方元数据，以及仓库当前代码。
> 结论：选择 **XState v5**；精确基线为 `xstate@5.32.6`，React 端使用 `@xstate/react@6.1.0`。不要采用仍处于 alpha 的 XState v6 core。

## 1. 结论先行

EgoCapture 不只是一个 React 组件需要状态管理，而是同时有：

- 约 15 个 PostgreSQL 持久化生命周期字段；
- 多处服务端跨实体、事务内状态联动；
- 一个包含哈希、准备、上传、暂停、恢复、对账、失败与取消的浏览器上传工作流；
- 对迁移图、非法边、可观测性、并发冲突和数据库旁路防护的统一要求。

因此推荐：

1. 在 `packages/core` 使用框架无关的 **XState v5 core** 定义每个领域状态机。
2. 服务端只调用 XState 的纯 `initialTransition()` / `transition()` 或等价 snapshot 解析能力，不在 Vercel/Next.js 请求之间保留常驻 actor。
3. Participant 上传队列在已有 Client Component 内使用 `@xstate/react`，由队列 actor 协调每个文件的子 actor、TUS 回调、重试与取消。
4. PostgreSQL 继续做最终权威：原子条件更新负责竞争检测，`BEFORE UPDATE` trigger 根据 `OLD`/`NEW` 拒绝非法边，审计与复合写入仍在同一事务。
5. 不把 XState actor snapshot 当成服务端业务事实，也不认为 actor mailbox 能解决多个请求、多个实例之间的数据库并发。

这个选择会替换当前设计中的“小型自研 `defineStateMachine` 内核”，但不会改变数据库 registry/trigger、稳定错误码、事务原子性、派生分类不强行建模等既定边界。

## 2. 当前仓库约束

### 2.1 技术栈

- 根项目要求 Node.js `>=24`，当前固定 Next.js `16.3.4`、React/React DOM `19.2.8`、TypeScript `6.0.3`，且 TypeScript 使用 `strict` 与 `moduleResolution: bundler`。见 [`package.json`](../../../../package.json#L6-L8)、[`package.json`](../../../../package.json#L63-L86) 和 [`tsconfig.json`](../../../../tsconfig.json#L9-L18)。
- `@egocapture/core` 当前没有状态机依赖，也没有 React 运行时依赖；因此领域机器可保持 framework-agnostic。见 [`packages/core/package.json`](../../../../packages/core/package.json#L9-L25)。
- Participant 已有手写邻接表，Assignment 则只有零散谓词，说明代码已开始表达迁移约束，但还没有统一机器契约。见 [`participant.ts`](../../../../packages/core/src/domain/participant.ts#L1-L29) 和 [`assignment.ts`](../../../../packages/core/src/domain/assignment.ts#L1-L30)。

### 2.2 状态规模与现状

- 当前状态盘点列出 15 个持久化生命周期：Participant、Consent projection、Invitation、Consent result、Device、Task、Assignment、RecordingSession、UploadBatch、UploadIntent transfer/metadata、UploadAttempt、VideoAsset、MetadataAttempt、ReviewCase。见 [`state-inventory.md`](./state-inventory.md#L3-L7)。
- 数据库现有 `CHECK` 主要限制状态值集合，例如 Participant、Assignment、Upload/Metadata、ReviewCase，但并不普遍约束“旧状态 → 新状态”。见 [`0001_core.sql`](../../../../database/migrations/0001_core.sql#L45-L46)、[`0001_core.sql`](../../../../database/migrations/0001_core.sql#L155-L166)、[`0001_core.sql`](../../../../database/migrations/0001_core.sql#L213-L285) 和 [`0001_core.sql`](../../../../database/migrations/0001_core.sql#L345-L389)。
- 上传队列已经有 10 个瞬时状态，但仍由 `useState` 加任意 `Partial<QueueItem>` patch 修改；异步 TUS 回调、暂停、恢复和取消会从多个位置写同一 item。见 [`upload-queue.tsx`](../../../../apps/participant-web/app/(portal)/uploads/upload-queue.tsx#L39-L68)、[`upload-queue.tsx`](../../../../apps/participant-web/app/(portal)/uploads/upload-queue.tsx#L100-L129) 和 [`upload-queue.tsx`](../../../../apps/participant-web/app/(portal)/uploads/upload-queue.tsx#L349-L485)。

这意味着“只给 UI 换成一个 reducer”无法完成需求；选型必须同时适合纯服务端领域规则和浏览器异步编排。

## 3. 候选方案总览

| 维度 | XState v5 | Robot3 | React `useReducer` | Redux Toolkit | 小型自研 typed kernel |
|---|---|---|---|---|---|
| 服务端 framework-agnostic | 强；core 官方明确支持前后端 | 强；core 无 UI 依赖 | reducer 函数可复用，但 Hook 仅限组件 | store/reducer 可运行在 Node，但 App Router 要 per-request store | 强 |
| React 19 / Next 16 | `@xstate/react` peer 明确支持 React 19；Hook 放 Client Component | `react-robot` peer 明确支持 React 19；Hook 放 Client Component | React 19 原生 | peer 支持 React 19，但还需 `react-redux`/Provider | 自行绑定 |
| 迁移、guard、action | 原生、强类型、命名实现 | 原生 guard/action/reduce | 全部手写在 reducer/switch | reducer/action 原生，迁移图和 guard 语义手写 | 全部自研 |
| 异步与取消 | invoke/spawn、Promise/callback actor、mailbox、cleanup/AbortSignal | Promise/child-machine invoke；取消与并发组合较弱 | Effect/orchestrator 手写 | listener middleware 可做异步，但不是状态图 | 全部自研 |
| 层级/并行/动态子流程 | 原生 statecharts 与 actors | 不支持并行；嵌套通过 child machine invoke | 手写 | 手写 | 手写 |
| 序列化/恢复 | 官方 persisted snapshot API；需处理版本兼容 | 官方文档承认较繁琐 | 自己定义 DTO | 默认 serializability 检查，但工作流恢复协议仍自定义 | 全部自研 |
| 检查/可视化/模型测试 | Inspect API、Stately Inspector、`xstate/graph` | debug hook；可视化和恢复能力明显较弱 | 无状态图工具 | Redux DevTools 强，但不是状态路径工具 | 全部自研 |
| 依赖/体积 | core 0 runtime deps，但发布包和浏览器成本高于 Robot3 | 最小；官方目标约 1 kB | 0 新依赖 | 6 个 runtime deps，且还需 React-Redux | 0 外部依赖，但形成内部维护成本 |
| PostgreSQL 并发安全 | **不提供** | **不提供** | **不提供** | **不提供** | **不提供** |
| 本项目适配结论 | **推荐** | 小型 UI FSM 可用，本项目能力不足 | 只适合局部 reducer | 本项目没有全局 store 需求，不推荐 | 规模越大越接近重造 XState，不推荐 |

## 4. XState v5 评估

### 4.1 版本与兼容性

截至调研日：

- npm stable 是 [`xstate@5.32.6`](https://www.npmjs.com/package/xstate)，发布于 2026-08-25；官方 release 页面同时把 v6 标为 pre-release、把 5.32.6 标为 latest stable。见 [XState releases](https://github.com/statelyai/xstate/releases)。
- [`@xstate/react@6.1.0`](https://www.npmjs.com/package/%40xstate/react) 的 npm peer contract 是 React `^16.8 || ^17 || ^18 || ^19` 与 XState `^5.28.0`。**这里 React adapter 的 major 6 仍对应 XState v5，不代表采用 XState v6。** 原始元数据见 [npm registry](https://registry.npmjs.org/%40xstate%2Freact/6.1.0)。
- XState v5 要求 TypeScript 5.0+ 并建议使用最新版本；仓库当前 TypeScript 6.0.3、`strict`、`skipLibCheck` 均满足其公开前提。见 [XState setup](https://stately.ai/docs/setup) 与 [v4 → v5 migration](https://stately.ai/docs/migration)。
- XState core 不依赖 React，官方说明可用于 frontend 和 backend；React adapter 才是 UI Hook 层。见 [XState npm](https://www.npmjs.com/package/xstate) 与 [XState React docs](https://dev.stately.ai/docs/xstate-react)。
- Next.js 没有一项单独的 “XState certification”。兼容依据是：core 是普通 TypeScript/JavaScript，React adapter 声明 React 19 peer；所有状态 Hook 与浏览器 API 必须位于 `'use client'` 边界。Next.js 官方也规定 state、effects、event handlers、`localStorage` 属于 Client Component，并提醒 client 边界下的 import 会进入 client bundle。见 [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)。

结论是“包契约与架构兼容”，不是“已经在本仓库安装并通过构建”。实施第一步仍应以精确版本完成 `typecheck + unit + Next production build` 小闭环。

### 4.2 为什么适合服务端领域生命周期

XState v5 从 5.19 起提供纯 `initialTransition(machine)` 和 `transition(machine, snapshot, event)`，可在不启动 actor 的情况下得到下一 snapshot 与 action intent。见 [Events and transitions](https://stately.ai/docs/transitions)。这正适合请求级服务命令：

```ts
const current = participantMachine.resolveState({
  value: row.status,
  context: lockedFacts,
});
const [next, actionIntents] = transition(
  participantMachine,
  current,
  commandEvent,
);
```

推荐约束：

- 每个实体各自一台小机器，不建立一个包含所有业务的巨型 actor system。
- `setup(...)` 声明 typed context/event/guard/action；状态和事件键保持稳定。官方 `setup` 会对 guards、actions、actors、input/output 和 snapshot 提供类型推断。
- 服务端机器保持纯：guard 只读已锁定事实，action 只描述 effect intent；数据库更新、审计和外部 I/O 仍由 service transaction 执行。
- 不为每条数据库记录常驻一个 actor。Serverless 实例可回收、可横向扩容；内存 actor 不是持久化锁，也无法仲裁另一个 Vercel 实例的请求。
- 依赖其他行的 guard 必须先锁定/读取相关行，并在同一事务内更新；不能只相信进入 XState 时看到的旧 snapshot。

XState 的 named guards/actions/actors 可以用 JSON-friendly 的 type/params 引用，把“机器图”和“运行时实现”分开。见 [State machines](https://stately.ai/docs/machines)、[Guards](https://stately.ai/docs/guards) 和 [Actions](https://stately.ai/docs/actions)。

### 4.3 为什么适合客户端上传队列

上传队列是 XState 相比 reducer/Robot3 的决定性收益点：

- actor 有私有状态与顺序 mailbox，一次处理一个 event；多个 TUS callback 不再直接用任意 patch 修改 QueueItem。见 [Actor model](https://stately.ai/docs/actor-model)。
- invoke 适合“进入 hashing/preparing/reconciling 状态时启动、离开状态时停止”的有限工作；spawn 适合动态数量的文件子 actor。见 [Actors](https://stately.ai/docs/actors) 与 [Spawn](https://dev.stately.ai/docs/spawn)。
- Promise actor 可接收 AbortSignal；callback actor 可返回 cleanup，适合包装 hash/fetch/TUS 生命周期和组件卸载清理。见 [Promise actors](https://dev.stately.ai/docs/promise-actors) 与 [Callback actors](https://stately.ai/docs/callback-actors)。
- `@xstate/react` 提供 `useActor` / `useMachine` / `useSelector`，只把有交互的上传区域放进 client graph；当前 `upload-queue.tsx` 本身已经是 `'use client'`，不会扩大现有边界。

建议结构：

```text
UploadQueue actor
  ├─ UploadItem actor(file A): hashing → ready → preparing → uploading → ...
  ├─ UploadItem actor(file B): hashing → failed → retrying → ...
  └─ UploadItem actor(file C): hashing → ready → aborted
```

父 actor 负责最大文件数、批次和 item 索引；每文件 actor 负责自身合法事件与 TUS 生命周期。上传字节、`File`、TUS client、AbortController 都是运行时资源，不应放进可持久化 snapshot。

### 4.4 序列化、检查与测试

XState v5 的 actor 可以用 `getPersistedSnapshot()` 获取可序列化状态，并通过 `createActor(logic, { snapshot })` 恢复；invoked/spawned actor 也支持 deep persistence。官方同时说明恢复会重启 invocation，且 action 不会重放。见 [Persistence](https://stately.ai/docs/persistence)。

但本项目不应直接把 opaque XState snapshot 变成数据库或 localStorage 长期契约：

- 服务端只持久化现有业务列、审计事件和幂等 receipt；XState snapshot 是请求内计算对象。
- 客户端继续持久化带版本的最小 Upload DTO（当前已有 `version: 2`），刷新后通过显式 rehydrate event 恢复机器。
- 原因是机器定义与 snapshot shape 都可能演进；官方明确说明 XState v5 snapshot 与 v6 不二进制兼容。见 [XState v6 FAQ](https://stately.ai/docs/xstate/v6/faq)。

可观测性和测试方面：

- Inspect API 暴 actor lifecycle、event、snapshot 和 transition microstep，可用于开发追踪；见 [Inspection](https://stately.ai/docs/inspection)。
- 普通 Vitest 可直接发送 event 并断言 snapshot/side effects；effect implementation 可以通过 `provide()` 替换为 fake。见 [Testing](https://stately.ai/docs/testing)。
- 模型测试工具已整合到 `xstate/graph`，可以生成路径、检查可达状态和覆盖边；见 [Graph utilities](https://stately.ai/docs/graph)。
- 对 EgoCapture，图测试只是应用层证据；还必须逐边跑数据库 parity test，证明 trigger 对同一合法/非法矩阵给出一致结果。

### 4.5 成本与风险

| 包 | 当前版本 | npm 发布包 unpacked size | runtime dependencies | 说明 |
|---|---:|---:|---:|---|
| `xstate` | 5.32.6 | 2,294,177 B / 132 files | 0 | 这是安装包体积，不是浏览器 bundle |
| `@xstate/react` | 6.1.0 | 37,966 B / 18 files | 2 | peer 支持 React 19、XState `^5.28.0` |

数据来自相应版本的 npm registry：[`xstate@5.32.6`](https://registry.npmjs.org/xstate/5.32.6)、[`@xstate/react@6.1.0`](https://registry.npmjs.org/%40xstate%2Freact/6.1.0)。

主要代价：

- 比 Robot3 或自研邻接表更重，statechart/actor 概念也有学习成本。
- XState 官方 SemVer policy 保留在 minor 中调整 TypeScript declarations、极少数行为的权利；升级前必须读 release note。见 [XState npm version policy](https://www.npmjs.com/package/xstate?activeTab=versions)。
- XState v6 正在快速 alpha 迭代，但尚非稳定版；本任务不应追 alpha。稳定 v5 最新发布仍在 2026-08，维护活跃。见 [releases](https://github.com/statelyai/xstate/releases) 与 [v6 FAQ](https://stately.ai/docs/xstate/v6/faq)。
- 本项目需要的不是整个 Studio 产品。运行时只依赖开源 core/React adapter；可视化服务不是生产依赖。

控制办法：精确固定首个验证版本、保留 lockfile、建立 graph/DB parity/production build 门禁，并把长期持久化格式保持在应用 DTO/数据库列而不是库内部 snapshot。

## 5. Robot3 评估

Robot3 是一个很好的“小 FSM”方案，但不适合作为本次统一状态架构。

### 优点

- 官方定位为 functional、immutable FSM；API 由 `createMachine/state/transition/guard/reduce/action/invoke/interpret` 等小函数组成。见 [Robot official docs](https://thisrobot.life/docs/) 与 [official source](https://github.com/matthewp/robot/blob/main/packages/core/machine.js)。
- 支持 guard、context reducer、Promise invoke 和 child-machine invoke；见 [guards](https://thisrobot.life/docs/concepts-guards/)、[invoke](https://thisrobot.life/docs/invoke/) 和 [nested states](https://thisrobot.life/docs/nested-states/)。
- 体积非常小：官方站点主张约 1 kB，仓库 bundlesize 上限为 1.4 kB；npm `robot3@1.2.0` 发布包为 27,757 B、0 runtime deps。见 [Robot docs](https://thisrobot.life/docs/)、[bundlesize.json](https://github.com/matthewp/robot/blob/main/packages/core/bundlesize.json) 与 [npm registry metadata](https://registry.npmjs.org/robot3/1.2.0)。
- `react-robot@1.2.1` 的 peer contract 包含 React 19 和 Robot3 `^1.0.0`。见 [npm registry metadata](https://registry.npmjs.org/react-robot/1.2.1)。

### 不选原因

- Robot 官方比较页明确写出：不支持 parallel states，没有 XState actor model，机器状态的序列化/恢复更繁琐，可视化能力较弱。见 [Robot vs XState](https://thisrobot.life/docs/comparison-with-xstate/)。该比较页示例仍使用旧 XState API，因此只把它作为 Robot 自己声明的能力边界，而不用于判断 XState v5 API。
- Robot 的 `invoke` 能等待 Promise 或 child machine，但动态 child actors、系统级 mailbox/inspect、正式 persisted snapshot、graph/model-based tests 都不是 core 的一等能力。
- 官方源码中的 Promise invoke 采用“完成时检查 machine 是否仍相同”避免 stale completion，但不像 XState Promise/callback actor 那样提供明确的 AbortSignal/cleanup 组合。见 [`machine.js`](https://github.com/matthewp/robot/blob/main/packages/core/machine.js)。
- `robot3@1.2.0` 发布于 2025-09-20，`react-robot@1.2.1` 发布于 2025-11-28；仍有维护迹象，但公开发布节奏、生态和工具面都小于 XState。见 [`robot3` metadata](https://registry.npmjs.org/robot3) 与 [`react-robot` metadata](https://registry.npmjs.org/react-robot)。

如果需求只是一个不持久化、无并行/动态子流程的组件弹窗，Robot3 会是更轻的选择；EgoCapture 已超出这个边界。

## 6. Reducer-only 与 Redux Toolkit 评估

### 6.1 React `useReducer`

React 19 的 `useReducer` 原生、零依赖；reducer 必须是纯函数，Strict Mode 在开发中双调用 reducer/initializer 以暴露非纯逻辑。见 [React `useReducer`](https://react.dev/reference/react/useReducer)。它非常适合把当前上传组件的 patch 更新先收敛成事件驱动更新。

但 reducer 不是状态机规范：

- `switch` 可以写任何状态到任何状态，非法边、terminal、guard、entry/exit effect 都要自己约定；
- 没有可查询的迁移拓扑、actor hierarchy、inspection protocol 或模型路径生成；
- Hook 只能运行在 React Client Component，不能直接作为 `packages/core` 的领域 API；
- async 生命周期、取消和 stale callback 仍要靠额外 orchestrator 与 refs 手写。

“纯 reducer + effect intent”是一个可接受的实现技术，但在 15 个服务端状态字段和上传 actor 场景下，它最终会演化成自研状态机框架。

### 6.2 Redux Toolkit

Redux Toolkit 比裸 reducer 提供 `createSlice`、serializability middleware 与 listener middleware；listener 可以 `take/condition/pause/delay/fork/cancel`，因此能拼出异步工作流。见 [createSlice](https://redux-toolkit.js.org/api/createSlice)、[listener middleware](https://redux-toolkit.js.org/api/createListenerMiddleware) 和 [serializability middleware](https://redux-toolkit.js.org/api/serializabilityMiddleware)。

它仍不是状态图引擎：没有内建的合法边/终态/层级状态图语义或模型路径覆盖。并且当前仓库没有 Redux，全局 store 也不是需求。Redux 官方对 Next App Router 明确要求 per-request store、RSC 不读写 store，并建议只把全局共享且可变的数据放入 Redux。见 [Redux Toolkit setup with Next.js](https://redux.js.org/usage/nextjs)。

截至调研日，`@reduxjs/toolkit@2.12.0` 发布于 2026-05-15，npm 发布包约 6,027,107 B / 172 files，并带 6 个 runtime dependencies；若用于 React 还需引入 `react-redux`。见 [npm page](https://www.npmjs.com/package/%40reduxjs/toolkit) 与 [registry metadata](https://registry.npmjs.org/%40reduxjs%2Ftoolkit/2.12.0)。为了状态机而引入 Redux store、Provider、Immer、Redux/Thunk/Reselect 和 listener 概念，不划算。

## 7. 小型自研 typed kernel 评估

原设计中的 `defineStateMachine` 可以用 TypeScript discriminated union、`never` exhaustiveness 和 readonly adjacency metadata 做到：

- 0 外部依赖、最小 bundle；
- 平坦生命周期迁移简洁；
- SQL registry 可直接从邻接矩阵生成固定 fixture；
- 所有 API 与错误结构完全由本项目控制。

TypeScript 官方文档也支持通过 discriminated unions 与 `never` 做穷尽检查。见 [TypeScript narrowing / exhaustiveness](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking)。

但要覆盖本需求，还必须继续自研：

- guard/action/effect intent 的类型系统；
- invoke/spawn、取消、stale completion、顺序 mailbox；
- snapshot schema/version/rehydration；
- inspect event、图导出、路径生成、不可达状态/边覆盖；
- React adapter 与 actor 生命周期 cleanup。

这已经不是“几十行帮助函数”，而是在长期维护一个内部 workflow runtime。仅为 15 个完全平坦、无异步的数据库状态，自研内核尚有吸引力；加上上传队列和统一 introspection/testing 后，XState 的成熟能力更值当。

## 8. PostgreSQL 如何与 XState 共存

### 8.1 权威边界

正确关系不是“XState 代替数据库约束”，而是：

```text
HTTP/API command
  → transaction 内读取/锁定当前事实
  → XState pure transition(current snapshot, event)
  → UPDATE ... WHERE id = ? AND status = expected_old RETURNING ...
  → database trigger 检查 OLD.status → NEW.status
  → 同事务写业务行、AuditEvent、idempotency receipt
  → COMMIT 后再执行不能纳入事务的外部 effect
```

PostgreSQL 官方说明：`UPDATE` 只更新 `WHERE condition` 为真的行，`RETURNING` 返回实际更新的行；0 行可映射成稳定 stale/conflict 错误。见 [PostgreSQL `UPDATE`](https://www.postgresql.org/docs/current/sql-update.html)。

普通 `CHECK` 适合限制当前行值域，但无法表达依赖旧版本的迁移历史。Row-level trigger 可以通过 `OLD` 与 `NEW` 检查旧/新状态，并在写入前拒绝操作。见 [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)、[trigger behavior](https://www.postgresql.org/docs/current/trigger-definition.html) 与 [PL/pgSQL trigger variables](https://www.postgresql.org/docs/current/plpgsql-trigger.html)。

### 8.2 双层契约而非双重漂移

- TypeScript/XState machine：应用层事件、guard、目标、UI capability、错误码。
- PostgreSQL transition registry + trigger：所有写入路径的最终旧值→新值防线。
- 契约测试：遍历每台 XState machine 的状态/事件/目标，逐边验证数据库允许矩阵；再对所有未声明边断言数据库拒绝。
- 并发测试：两个事务用同一 `expected_old` 发起竞争，断言只有一个 `UPDATE ... RETURNING` 成功，另一个返回 stale conflict，AuditEvent 与副作用不重复。
- 复合命令：先按固定顺序锁定所有相关行，再分别计算各机器 transition，任何数据库 trigger/guard/写入失败则整体回滚。

即便 XState actor 在单进程内顺序处理 event，也不能替代这些测试；Vercel 多实例与 Supabase 数据库并不知道浏览器/Node 内存中的 actor mailbox。

## 9. 推荐落地方式

### 9.1 依赖边界

- `packages/core`: `xstate@5.32.6`。
- `apps/participant-web`: `@xstate/react@6.1.0`，并通过 workspace 中的 core 机器使用。
- `apps/admin-web`: 默认不引入 React adapter；如果某个管理端交互确实需要本地 actor，再按组件级引入。
- 不安装 XState v6 alpha、不安装 Stately Studio runtime、不安装 Redux/Robot3。

### 9.2 机器设计约束

- 每个状态机有 stable `id`、显式 initial/final、typed event union、纯 guard 与 named action intent。
- 持久化状态键继续使用数据库英文键；i18n 只在展示层翻译。
- XState context 只保存决定迁移的瞬时事实；数据库连接、Request、File、TUS client、AbortController 等资源不进入 durable context。
- UI 不再散落比较 `status === ...`，而使用 machine snapshot 的 `can(event)` / tags / selector 决定能力。
- 现有派生分类继续是纯函数，不为了统一外观而伪造成 machine。

### 9.3 实施前最小验证门禁

在正式批量重构前，先做一个最小垂直切片：

1. 精确安装上述两个版本。
2. 把现有 Participant 手写邻接表迁成一台 XState v5 machine，保留兼容导出。
3. 服务测试验证 pure transition 的允许、拒绝、terminal 与 guard。
4. 用一个两文件上传 fixture 验证 React actor、Promise/callback cleanup、pause/resume/cancel。
5. 跑 `pnpm typecheck`、相关 Vitest、Participant web 的 Next production build。
6. 对构建输出测量实际 client chunk 增量；npm unpacked size 不能替代 bundle 证据。
7. 通过后再迁移其余机器与数据库 trigger；失败则回到 typed kernel，而不是边修边铺开 15 台机器。

## 10. 最终决策记录

**采用 XState v5。**

决策理由按重要性排序：

1. 同一个 framework-agnostic core 能服务请求级纯领域迁移和 React 19 客户端 actor。
2. 上传队列确实需要 actor/mailbox/invoke/spawn/cleanup，而不仅是一个 reducer。
3. Inspect 与 graph/model testing 能把“所有状态都用状态机”变成可验证的图契约。
4. 官方 React peer 已覆盖 React 19，XState core 当前仍有稳定 v5 发布；Next.js 边界可清晰隔离。
5. 额外依赖和学习成本可控，且低于自行补齐同等 runtime/tooling 的长期成本。

**非结论：** XState 不负责数据库并发，不是 PostgreSQL 的替代品，也不应在服务端跨请求常驻。真实权威仍是 PostgreSQL 的条件更新、trigger、事务与审计。

## Primary sources

- XState: [official docs](https://stately.ai/docs)、[official repository](https://github.com/statelyai/xstate)、[v5 releases](https://github.com/statelyai/xstate/releases)、[npm](https://www.npmjs.com/package/xstate)
- XState capabilities: [setup](https://stately.ai/docs/setup)、[transitions](https://stately.ai/docs/transitions)、[actors](https://stately.ai/docs/actors)、[persistence](https://stately.ai/docs/persistence)、[inspection](https://stately.ai/docs/inspection)、[testing](https://stately.ai/docs/testing)、[graph](https://stately.ai/docs/graph)
- React/Next: [`@xstate/react`](https://dev.stately.ai/docs/xstate-react)、[React `useReducer`](https://react.dev/reference/react/useReducer)、[Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- Robot3: [official docs](https://thisrobot.life/docs/)、[official repository/source](https://github.com/matthewp/robot)、[npm `robot3`](https://www.npmjs.com/package/robot3)、[npm `react-robot`](https://www.npmjs.com/package/react-robot)
- Redux Toolkit: [official docs](https://redux-toolkit.js.org/)、[Next.js guide](https://redux.js.org/usage/nextjs)、[npm](https://www.npmjs.com/package/%40reduxjs/toolkit)
- TypeScript: [discriminated unions and exhaustiveness](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking)
- PostgreSQL: [`UPDATE`](https://www.postgresql.org/docs/current/sql-update.html)、[constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)、[trigger behavior](https://www.postgresql.org/docs/current/trigger-definition.html)、[trigger functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
