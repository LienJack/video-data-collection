# Merge MVP to main and deploy production

## Goal

将 `codex/egocapture-mvp` 的已审阅提交通过 Pull Request 集成到 `main`，随后把合并后的精确 `main` commit 发布到现有 EgoCapture Participant/Admin 两个 Vercel Production 项目，并以公网健康检查和完整业务验收证明发布成功。

## Background

- 2026-09-03 预检时，`HEAD=e0c2d85`，`origin/main=bde3b9b`；当前分支相对 `main` 为 `0 behind / 83 ahead`，GitHub 上还没有该分支的 PR。
- 当前工作区另有参与者表格/抽屉及相关 Trellis 任务的未提交改动。这些内容不属于本次已固定发布快照，必须原样保留且不得进入 PR 或 Vercel 构建上下文。
- GitHub CLI 已登录 `LienJack`，仓库默认分支为 `main`，PR/`main` push 均会运行 CI；`main` 当前无 branch protection，仓库允许 merge、rebase 与 squash。
- 现有生产资源已经创建且身份已核验：Supabase `egocapture-demo` (`phchhsatgoxlqqhpnnfk`, `us-west-1`, `ACTIVE_HEALTHY`)；Vercel `egocapture-participant` (`prj_7d3CY9Ufac7mElPp8zFcj9XdrABq`) 与 `egocapture-admin` (`prj_uTBUH1q87MwrtdOpdiab7Wf7Jo4T`) 均为 Node 24、各自绑定正确 Root Directory。
- 当前两个 production alias 均为 `READY`，`/api/health` 返回 HTTP 200、数据库可用且 migration frontier 为 24。本任务是现有专用资源的重新发布，不创建新云资源。

## Requirements

### R1. Release boundary

- PR 只包含当前分支已经提交的 83 个提交，以及为本次发布检查所必需的最小修复和本任务的 Trellis 记录。
- 不暂存、不覆盖、不清理工作区中既有的未提交参与者页面、CSS、测试、其他 Trellis 任务或 `需求.md`。
- 所有验证和 Vercel 部署均从临时、干净、绑定精确 commit 的 Git worktree 执行。

### R2. Pre-merge validation

- 在干净快照上运行 `pnpm install --frozen-lockfile`、`git diff --check origin/main...HEAD`、`pnpm check` 与 `pnpm repo:safety`。
- 修复当前已知的 whitespace release blocker；若发现其他失败，只修改能够由证据直接归属于本次发布快照的内容。
- 推送后等待 Pull Request 的 `quality`、`repository-safety`、`browser-acceptance` 全部成功，不以本地结果替代 GitHub Actions。

### R3. Pull Request and merge

- 推送 `codex/egocapture-mvp`，创建目标为 `main` 的非 Draft PR，正文记录范围、验证、云资源边界与发布步骤。
- 使用 merge commit 合并，以保留 83 个分阶段、可审计的 Trellis/功能提交；不 force-push，不直接改写 `main` 历史。
- 合并前重新确认 PR head SHA、mergeability 和全部 checks；合并后重新 fetch 并记录 `origin/main` 的 merge SHA。

### R4. Production deployment

- 仅部署到上述两个既有 Vercel project，不修改无关 Vercel/Supabase 项目，不购买或升级套餐。
- 从合并后的精确 `origin/main` SHA 创建隔离 worktree，逐个显式 link 正确 project，并从仓库根目录执行 production deploy。
- Supabase 继续使用已核验的专用 ref；若 schema frontier 仍为 24，不重复执行迁移。任何 project/ref、区域、连接或付费边界不匹配都必须 HOLD。
- 两个 production alias 只有在 deployment 为 `READY` 后才算发布完成；记录 deployment ID、alias 和 source SHA，但不记录秘密值。

### R5. Public acceptance and cleanup

- 验证 Participant/Admin production alias 的 `/api/health`、migration count、跨应用 404 隔离与公开页面可访问性。
- 使用本地受忽略且权限为 `0600` 的生产配置运行 `pnpm test:e2e:public`，验证三语言登录、Cookie 隔离、真实 MP4 signed TUS、metadata、review 与 audit 闭环。
- 公网写入验收后，仅对已核验的 EgoCapture 专用环境执行 guarded deterministic demo refresh，再验证 seed、RLS、private Storage 与对象清理。
- 检查两个新 deployment 的 5xx/关键错误日志；敏感值不得出现在 Git、PR、任务记录或命令总结中。

### R6. Rollback and evidence

- 若任一新 deployment 或公网验收失败，保持/恢复 production alias 到本任务开始时的已验证 deployment：Participant `dpl_2PN54Lc91sVmdTKTTSt39JHPbJKF`，Admin `dpl_6FX2VsXRuwUFQfzKdqp4qSpoAHV9`。
- 通过 PR 描述/评论和最终交付记录 source SHA、merge SHA、deployment IDs、CI 链接及逐项 PASS/HOLD；现有 `docs/acceptance/2026-09-03-public-deployment.md` 保持为旧固定提交的历史证据，不改写成新发布证明。

## Acceptance Criteria

- [ ] PR 已从 `codex/egocapture-mvp` 创建到 `main`，没有带入预存未提交改动，且全部 GitHub Actions checks 成功。
- [ ] PR 通过 merge commit 合并，`origin/main` 包含经验证的 PR head，且合并 SHA 已记录。
- [ ] Participant/Admin 均从精确合并 SHA 产生新的 `READY` Production deployment，默认 production alias 指向新 deployment。
- [ ] 两端 health、migration 24、route/Cookie 隔离、三语言登录和完整 public E2E 业务闭环通过。
- [ ] 写入型验收数据已由 guarded refresh 清除，确定性 seed/RLS/private Storage 验证通过。
- [ ] 新 deployment 的 5xx/关键错误检查通过；若失败则已恢复到两个已记录的上一版 deployment。
- [ ] 没有购买、升级、触碰无关云项目、泄露秘密或覆盖工作区并行改动。

## Out of Scope

- 将当前未提交的参与者表格/抽屉工作并入本次 PR。
- 新建或删除 Vercel/Supabase 资源、自定义域名、套餐升级、多区域/灾备配置。
- 变更生产数据库 schema、重新生成凭据，除非发布过程中发现直接且必须处理的安全事件；此类情况需按 HOLD 边界处理。
- 声明数 GB、4K、跨天、美国独立客户端延迟或其他本次未实际观测的能力。
