# 系统说明文档中心实施计划

## Parallel ownership

- Archify subagent exclusively owns `docs/system-guide/diagrams/**` and `apps/admin-web/public/system-guide/diagrams/**`.
- Documentation subagent exclusively owns `apps/admin-web/app/(console)/system-guide/**`.
- Navigation/test subagent exclusively owns `apps/admin-web/app/(console)/layout.tsx`, `apps/admin-web/app/(console)/console-navigation.tsx`, and `tests/e2e/system-guide.spec.ts`.
- All subagents share the worktree, must preserve others' edits, and must not stage, commit, archive the task, or modify unrelated files. The main agent owns integration, final checks, explicit staging, commit, spec/journal update, and task archive.

## 1. Preflight and evidence freeze

- [x] 读取 root/admin-web AGENTS、Next.js 16.3.4 `public`、Route Group、Link 与 Metadata 文档。
- [x] 复核 Admin 共享布局、认证边界、现有页面间距和移动端导航，不改动并行任务拥有的页面。
- [x] 复核 README、当前 TUS 客户端代码、Multipart 预留 migration、既有大文件与直播研究快照，建立文章事实清单。
- [x] 记录起始 `git status --short`，后续只显式暂存本任务文件。

## 2. Author and validate four Archify diagrams

- [x] 在 Archify Skill 目录读取 `architecture`、`sequence`、common schema 和各一个示例；候选前不查看 renderer internals。
- [x] 创建系统架构 `architecture` JSON；运行 update checker 一次。
- [x] 创建双端联动、Multipart 恢复、直播归档三份 `sequence` JSON。
- [x] 每次编辑后运行 `validate ... --quality showcase --json`，按 diagnostics 做单点修复。
- [x] 对冻结候选运行 `deliver`，输出到 Admin public 目录；不得在成功 deliver 后修改规格。
- [x] 对四份精确 HTML 运行 `visual-check --json`，保存 receipt/screenshot 路径并进行图像视觉审阅。

完成标准：四张图各自 9 项 artifact checks 全通过，0 composition errors / warnings，确定性 receipt 与浏览器证据可追踪。

## 3. Build the protected documentation center

- [x] 新增 `/system-guide` Server Component 页面和专属 metadata。
- [x] 实现 sticky/horizontal TOC、四个语义 article、当前/未来能力标签、结论卡、关键步骤、边界与官方延伸阅读。
- [x] 实现共享 `GuideDiagram`：同源 iframe、描述性 title、lazy loading、responsive frame 和新标签页打开入口。
- [x] 为 committed diagram HTML 添加仅允许同源 framing 的路径级安全头覆盖；保持其他 Admin 路径 `DENY`，并用 Playwright 读取响应头和 iframe body 验证。
- [x] 使用现有 UI token/组件和 Phosphor 图标，不新增文档渲染依赖或远程内容加载。
- [x] 确认文章事实与代码/研究一致，尤其是 TUS 24 小时边界、Multipart 未启用、直播未实现与公网部署状态。

完成标准：Admin 登录后可阅读四篇中文文章和四张图；直接 URL 与锚点可用，未来方案不会被误读为现状。

## 4. Add the Admin-only entry

- [x] 在 Admin shared layout 增加桌面右上角“系统说明”utility link。
- [x] 在移动端右上角操作区或“全部功能”中提供同一入口，保证 44px 点击目标。
- [x] `/system-guide` 使用 selected/`aria-current` 状态；Participant Web 不增加入口。
- [x] 检查入口不遮挡现有页面标题、任务操作按钮、移动导航或 safe area。

## 5. Automated and visual verification

- [x] 新增 Playwright 用例：Admin 入口、auth redirect、四篇文章、四张图、锚点与新标签页链接。
- [x] 断言图表 HTML 响应为 `X-Frame-Options: SAMEORIGIN`、CSP `frame-ancestors 'self'`，且 iframe 文档实际加载。
- [x] 验证 Participant Web 不出现“系统说明”。
- [x] 在 1440×900 与 390×844 验证页面无横向溢出、目录与 iframe 可读；保存截图并进行感知审阅。
- [x] 运行 `pnpm lint`、`pnpm typecheck`、相关 Playwright 用例和 `pnpm --filter @egocapture/admin-web build`。
- [ ] 运行完整 `pnpm check`、`pnpm repo:safety` 与 `git diff --check`。（`pnpm check` 与 `git diff --check` 已通过；`repo:safety` 被并行分页任务删除 `packages/core/src/server/cursor.ts` 阻塞。）

## 6. Trellis check, scoped commit, and finish

- [x] Trellis check 子代理复核事实边界、权限、入口可访问性、图表证据、响应式布局与测试覆盖。
- [x] 修复经代码/截图验证的 blocker；必要时重新运行受影响的 Archify 或产品门禁。
- [ ] 完成最终 staged diff 审计，仅暂存：本任务 Trellis 文件、Admin system-guide 入口/页面/测试、图表 specs 与 artifacts。
- [ ] 明确排除其他 `09-02-*` Trellis 任务、bootstrap guidelines 与 `需求.md`。
- [ ] 创建一个 scoped commit，记录验证结果与 commit SHA，随后按 Trellis finish 流程更新 spec/journal 并归档任务。

## Rollback points

- 图表层：删除 public diagram artifacts 与 source specs，不影响页面外业务。
- 页面层：删除 `/system-guide` 路由和共享 guide components，不影响 Admin 数据/API。
- 入口层：回退 Admin layout 的 utility link 即恢复原导航；无数据库或外部资源需要回滚。
