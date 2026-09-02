# 采集记录工作台实施计划

## 0. Preconditions and ownership

- [ ] 阅读本任务 `prd.md`、`design.md`、`implement.md` 和上下文清单。
- [ ] 运行 `git status --short`，记录并保护现有并行修改；本任务不得修改或暂存无关路径。
- [ ] 阅读 `apps/admin-web/AGENTS.md`，并从当前 `node_modules/next/dist/docs/` 核对 Page `searchParams`、Link 和 redirect API。
- [ ] 阅读上下文清单中的 cross-layer 与 reuse guides。
- [ ] 运行 Admin build、`tests/e2e/task-workbench.spec.ts` 和涉及 `/uploads` 的 smoke/main-flow 基线。

完成标准：基线、既有失败和本任务 owned paths 已记录，未覆盖并行改动。

## 1. Lock query and presentation contracts

- [ ] 为 `RecordsTab`、URL 查询归一化、状态/action 呈现器编写 focused tests。
- [ ] 新增 `apps/admin-web/lib/record-presenters.ts`，集中实现中文状态、Audit action/entity 标签和未知值回退。
- [ ] 让现有 task upload/audit panels 使用共享呈现器，删除局部重复常量。
- [ ] 验证非法 tab/筛选、超长 search、未知 action 和 null Session/Task。

完成标准：呈现和查询边界被测试固定，同一状态/action 不再多处定义。

## 2. Build read-only service projections

- [ ] 新增 `getAdminRecordSummary(viewer)`，用单条聚合 SQL 返回上传/开放会话指标和缺失、失败、Metadata 失败、重复候选、未匹配、设备不一致异常分类。
- [ ] 扩展 `adminUploadListSchema/listAdminUploads`：关联任务、声明/最终 Session、最新开放 ReviewCase，并让 search 覆盖 Session public ID。
- [ ] 扩展 `adminSessionListSchema/listAdminSessions`：返回 task public ID、closedAt、matchedVideoCount。
- [ ] 扩展 `auditListSchema/listAuditEvents`：第一阶段只支持受控 category 和 search，保持 `(created_at, id)` 游标。
- [ ] 检查 join/subquery 没有重复行；覆盖 rejected decision、无 Session、多个开放 ReviewCase、system actor。
- [ ] 在开发数据库检查查询计划；若需要索引，暂停并单独评估 Migration。

完成标准：服务返回与 `design.md` 一致，现有消费者通过类型检查，分页/筛选组合有回归证明。

## 3. Implement the `/records` shell

- [ ] 新建 `records/page.tsx`，在 `requireAdmin()` 后解析一次查询，用 `Promise.all` 读取汇总和当前页签。
- [ ] 用 `<Link>` 和 `aria-current` 实现 URL 页签；默认/非法 tab 均进入视频记录。
- [ ] 实现上传/开放会话指标和异常分类入口；缺少上传链接到 Assignment/Participant 缺失视图，其他异常链接到对应 Review 筛选。
- [ ] 新建 route-level `loading.tsx`。
- [ ] 筛选使用 GET form；提交移除 cursor，清除筛选保留 tab。

完成标准：无数据、慢查询和非法 URL 下页面均可达，切换只查询当前页签。

## 4. Implement the video records tab

- [ ] 实现桌面和窄屏布局，展示文件、参与者、任务、Session 和四层状态。
- [ ] 根据 `primaryReviewPublicId` 选择“处理异常”或“查看视频详情”。
- [ ] 构造稳定的搜索、Transfer、Metadata、attention 和游标链接；不得用假的 Upload 行表达缺少上传。
- [ ] 实现初始空状态与筛选无结果状态。
- [ ] 验证长文件名、rejected match、对象已删除和多个 ReviewCase。

完成标准：管理员一次操作进入详情或处理异常，列表不复制详情页的预览/重试操作。

## 5. Implement the recording sessions tab

- [ ] 缺省应用 `status=open`，显式提供开放/已关闭/全部筛选，并让搜索覆盖已关闭 Session。
- [ ] 展示 Marker、设备、开始/关闭时间、匹配视频数及关联实体链接。
- [ ] 复用 `SessionClose`；已关闭记录不渲染关闭入口。
- [ ] “查看相关视频”跳转到按 Session 搜索的视频页签。
- [ ] 实现开放会话为空与筛选无结果状态。

完成标准：默认聚焦未关闭会话，关闭仍校验原因并在刷新后更新状态。

## 6. Implement the activity tab

- [ ] 用共享 action/entity 呈现器生成中文时间线。
- [ ] 用原生 `<details>` 收纳原始 action、request ID 和 before/after JSON。
- [ ] 实现关键词、category 筛选和携带筛选条件的游标；操作者/任意时间范围筛选留到后续任务。
- [ ] 覆盖未知 action、system actor、无 reason、单侧 before/after。
- [ ] 保持只读，不增加 Mutation。

完成标准：普通管理员先看到可读摘要，排障人员仍能展开完整证据。

## 7. Migrate navigation and legacy routes

- [ ] 将桌面折叠组替换为单一“采集记录”主导航项。
- [ ] 同步移动端菜单，确认 `/records` 和管理员 `/uploads/[id]` 的导航上下文。
- [ ] 将旧 `/uploads`、`/sessions`、`/audit` 页面改为保留兼容参数的 307 redirect。
- [ ] 确认参与者 `/uploads` 和管理员 `/uploads/[uploadPublicId]` 不重定向。

完成标准：新旧入口到达规范工作台，详情和参与者上传路由保持原行为。

## 8. Focused browser acceptance

- [ ] 新增 `tests/e2e/records-workspace.spec.ts`，覆盖登录、导航、默认页和三个 URL 页签。
- [ ] 覆盖视频详情/Review 一跳、Session 默认 open、关闭原因校验、操作记录详情展开。
- [ ] 覆盖旧列表 URL 跳转和上传详情不跳转。
- [ ] 在 320×760 与桌面视口验证无页面级横向滚动。
- [ ] 用键盘完成页签、筛选、清除筛选和主操作，检查 focus 可见。
- [ ] 对初始空和筛选无结果至少各提供一条自动化证明。

完成标准：主要操作、兼容路径和窄屏行为均有自动化证据。

## 9. Full validation gate

按顺序执行并保存实际输出：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @egocapture/admin-web build
pnpm exec playwright test tests/e2e/records-workspace.spec.ts --project=chromium
pnpm check
pnpm test:e2e
pnpm repo:safety
```

- [ ] 把预期业务错误路径与真实失败分开解释。
- [ ] 检查 `git diff --check`。
- [ ] 搜索旧菜单标签、原始英文页标题和重复 status/action 映射。
- [ ] 确认没有数据库 Migration、参与者端或并行任务文件进入本任务 diff。

完成标准：所有适用 gate 通过；无法运行的 gate 标为未验证，不能以局部测试代替完整验收。

## 10. Review, rollback, and scoped commit

- [ ] 映射 PRD AC1–AC13 到代码或测试证据，并明确公网部署和生产级多 GB/跨区域上传未由本任务证明。
- [ ] 确认 307 redirect 可通过恢复旧页面回滚，且没有数据迁移依赖。
- [ ] 只暂存本任务 owned paths；禁止 `git add -A`。
- [ ] 运行 `git diff --cached --check` 并审阅 staged diff。
- [ ] 创建一个 scoped commit，建议信息：`refactor(admin): consolidate collection records workspace`。
- [ ] 提交后确认用户和其他任务的工作树修改仍保留。

完成标准：一个 scoped commit 包含完整、已验证的重构，不夹带 Trellis 初始化或并行功能。

## Approval gate

用户审核 `prd.md`、`design.md`、`implement.md` 并明确批准后，才运行：

```bash
python3 ./.trellis/scripts/task.py start 09-02-admin-records-workspace
```

批准前任务保持 `planning`，不修改产品代码。
