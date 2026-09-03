# 参与者查看与编辑侧边栏实施计划

## 1. Preflight

- [x] 确认统一分页和参与者凭据子任务已提交并通过检查。
- [x] 读取 root/admin-web AGENTS 与 Next.js 16.3.4 Client Component、navigation 和 Route Handler 指南。
- [x] 检查 Participants Table 最终结构与详情/凭据 API 合同，不修改服务端密码同步实现。

## 2. Drawer component

- [x] 增加每行查看/编辑操作和右侧 native dialog drawer。
- [x] 实现按需详情加载、loading/error/view/edit 状态和关闭清理。
- [x] 实现 Escape、backdrop、关闭按钮、滚动锁定和触发按钮焦点恢复。
- [x] 适配桌面有限宽度与窄屏全宽布局。

完成标准：管理员无需离开分页列表即可查看或编辑单个参与者，键盘和 modal 语义可用。

## 3. Credential presentation

- [x] 显示登录地址、Participant ID、明文参与者密码和 missing/pending/ready 状态。
- [x] 实现分别复制帐号/密码与一键复制完整登录信息，提供 aria-live 成功/失败反馈。
- [x] 接入生成/重置/继续同步动作、确认提示、busy/error 状态与 Fixture 禁用说明。
- [x] Drawer 关闭时清除详情和密码 React state。

完成标准：管理员稍后重新打开仍可查找当前凭据；ready 凭据复制后可直接发给参与者登录。

## 4. Profile editing

- [x] 复用 RegionalPreferencesFields 与现有 PATCH schema，仅提交批准的六类基础资料和 expectedUpdatedAt。
- [x] 处理表单校验、网络错误、API 错误与 409 乐观锁冲突。
- [x] 成功后关闭、清理、`router.refresh()`，保留当前分页/筛选 URL。
- [x] Fixture 查看正常但保存不可执行。

## 5. Verification

- [x] 增加 drawer/clipboard/profile form 组件测试。
- [x] `pnpm test -- participant-drawer`（最终执行 `pnpm exec vitest run tests/unit/participant-drawer.test.tsx`，12/12）。
- [x] `pnpm participant:test`、`pnpm typecheck`。
- [x] `pnpm --filter @egocapture/admin-web build`。
- [x] Playwright 验证查看、编辑、复制、凭据生成、Fixture、Escape、backdrop、焦点返回和窄屏布局；错误、重试与既有凭据 reset 分支由 12 个组件测试和已合并的 participant integration check 覆盖。
- [x] 在 `?page=...` 和多筛选 URL 下保存，确认 URL 与刷新后的行值不丢失。

## 6. Review and commit

- [x] Trellis check 子代理复核状态机、可访问性、敏感字段边界、分页共存和测试覆盖。
- [x] `git diff --check`；显式暂存 Participants 操作列、drawer 组件/测试和本任务 Trellis 文件。
- [x] 确认 staged diff 不含分页基础、凭据后端、任务详情动作、bootstrap guidelines 或 `需求.md`。
- [ ] 创建一个 drawer 子任务 scoped commit，并记录 commit SHA 后归档子任务。
