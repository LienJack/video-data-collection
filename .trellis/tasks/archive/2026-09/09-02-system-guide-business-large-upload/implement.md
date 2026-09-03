# 系统指南业务流程与超大文件上传实施计划

## Ownership

- 文章实现拥有：`apps/admin-web/app/(console)/system-guide/page.tsx`、`system-workflow-article.tsx`、`resumable-upload-article.tsx`，如确有需要可修改 `guide-components.tsx`。
- 图表实现拥有：`docs/system-guide/diagrams/system-workflow.*.json`、`docs/system-guide/diagrams/multipart-resume.sequence.json`，以及对应 `apps/admin-web/public/system-guide/diagrams/system-workflow*`、`multipart-resume*` 产物。
- 集成与测试拥有：`tests/e2e/system-guide.spec.ts`、本任务 Trellis 文件和最终显式暂存/提交。
- 所有执行者共享工作区，必须保留现有并行改动，不得修改、回退或暂存其他任务文件。

## 1. Preflight

- [x] 记录实现开始前 `git status --short` 和本任务 owned paths。
- [x] 阅读 installed Next.js 的 public folder、Route Group/Server Component 和 Metadata 相关文档，遵循仓库的 breaking-change 提示。
- [x] 读取 Archify workflow/sequence/common schema 与各一个示例；在候选生成前不查看 renderer internals。
- [x] 核对外部研究证据与 `docs/acceptance/2026-09-02-local-mvp.md`，固定当前 TUS 与未来 Multipart 的陈述边界。

## 2. Rewrite the two business articles

- [x] 把第 02 章改写为五阶段业务旅程，加入明确完成定义、管理员/参与者责任交接和异常闭环。
- [x] 移除数据库表、migration、service 文件和内部实体链作为正文依据；只在必要处使用自然语言业务名称。
- [x] 把第 03 章改写为“一个数 GB 文件如何上传和恢复”的连续故事，讲清分片、已确认进度、暂停、刷新、重选、缺片补传、合并、完整性校验和过期。
- [x] 加入“暂停与取消”“短期授权过期与上传会话过期”“传输完成与业务接受”的对照。
- [x] 用当前/未来/边界标签明确 TUS 已验证范围与 Multipart 未实现状态。
- [x] 调整页面导语为 Leader 可读的业务与方案说明；保持现有四章 IA、锚点和 Admin 权限。

## 3. Re-author Archify artifacts

- [x] 尝试新的 `system-workflow.workflow.json` 候选并运行 Archify 门禁；候选未满足组合约束后删除，不保留双 source ownership。
- [x] 以业务型 sequence 表达管理员、参与者、采集设备、系统之间的一条主路径和可恢复异常路径，不再展示内部技术调用链。
- [x] 更新 `multipart-resume.sequence.json`，只保留参与者、上传器、上传服务、对象存储四个角色，并按初始化、恢复、完成三段组织。
- [x] 每次候选编辑后运行 `node bin/archify.mjs validate <type> <candidate> --quality showcase --json`；只按诊断修复。
- [x] 最终验证通过后运行 `deliver` 输出到既有 public HTML URL；成功后未再编辑冻结候选。
- [x] 对精确 HTML 运行 `visual-check --json`，保存 receipts/screenshots，并用图像能力审阅亮/暗主题的布局与可读性。

## 4. Extend focused product tests

- [x] 更新 `tests/e2e/system-guide.spec.ts`，断言 Leader 向核心文案、当前/未来标签、原有锚点和两张图实际可加载。
- [x] 保留 Admin auth、同源 iframe 安全头、Participant 不暴露入口和移动端无横向溢出的既有断言。
- [x] 增加内容回归断言：一次采集完成不等于上传 100%，刷新后重新选择原文件、只补传缺失分片、Multipart 为未来方案。

## 5. Validate

- [x] 对两张 Archify 图检查 showcase receipt：9 checks、0 composition errors、0 warnings。
- [x] 检查 1440×900、1600×1000、1920×1080、2048×1320 的 document scrollWidth/scrollHeight containment；不得用裁剪伪造通过。
- [x] 运行 Admin 相关 lint、TypeScript/build 和聚焦 Playwright 测试。
- [x] 运行 `pnpm check`、`pnpm repo:safety` 与 `git diff --check`，全部通过。
- [x] 执行 Trellis check，验证事实、可读性、可访问性、图表语义和测试覆盖；无 blocker。

## 6. Finish

- [x] 评估 code-spec 更新：本任务只重写说明内容与图表，没有新增或改变可执行 API、数据、基础设施或跨层合同，因此不修改 `.trellis/spec/`；实现选择与验证边界记录在本任务设计和研究文件中。
- [x] 审计最终 diff，只显式暂存本任务 owned paths；禁止 `git add .`。
- [x] 创建一个聚焦 commit `b9e4fe8`，记录验证结果和范围。
- [ ] 按 Trellis finish 流程更新 journal 并归档任务。

## Rollback points

- 文章：恢复两个 article 和 page 导语即可，不影响运行逻辑。
- 图表：恢复旧 source 和已提交 public artifacts；原 URL 不变。
- 测试：恢复本任务新增的内容断言；原权限与 iframe 安全测试继续保留。
