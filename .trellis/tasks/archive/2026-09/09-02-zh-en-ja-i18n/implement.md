# Implementation Plan

## Foundation

- [x] 建立 locales、negotiation、catalog type、translator、interpolation、Intl formatter 及测试。
- [x] 建立 UI Provider、server adapters、locale Route Handler 和 LanguageSwitcher。
- [x] 在两个 root layout 设置 locale、`html lang`、metadata 与 catalog provider。

## Coverage Migration

- [x] 先迁移共享导航、登录、错误/404/loading、状态/动作标签和通用组件。
- [x] 迁移 Participant 的任务、Session、marker、上传队列及邀请流程。
- [x] 迁移 Admin 的 dashboard、participants/devices、tasks、sessions、review、records/audit。
- [x] 迁移系统指南正文和三语言 diagram source/assets。
- [x] 将 DomainError/Zod/客户端异常展示改为 code→localized message。

## Formatting and Guardrails

- [x] 替换散落的 date/number/region formatting 为共享 helpers。
- [x] 添加 catalog key parity 和插值参数测试。
- [x] 添加应用硬编码用户文案扫描；Participants 临时豁免已删除，仅保留协议/产品标识的窄白名单。

## Validation

- [x] `pnpm test -- tests/unit/i18n.test.ts tests/unit/regional-preferences.test.tsx`
- [x] `pnpm i18n:check`
- [x] `pnpm typecheck && pnpm lint && pnpm build`
- [x] `pnpm test:e2e -- tests/e2e/i18n.spec.ts tests/e2e/main-flow.spec.ts tests/e2e/system-guide.spec.ts`
- [x] 在三种语言中检查语言持久化、查询参数、错误文案、状态标签和 `<html lang>`。
- [x] `git diff --check`；主代理将对并行占用的 Participants/Globals 文件做精确局部暂存。

## Dependency and Rollback

- 状态机 child commit 必须先完成，以便 catalog 使用稳定 machine/state/error keys。
- 当前 participant drawer/task-detail 并行改动必须先独立提交，避免翻译提交隐式吞入未跟踪组件。
- 本子任务不重置数据、不创建云项目。

## Evidence

- `pnpm i18n:check` 通过：三语目录/占位符一致，两个应用无未豁免用户硬编码，12 个 System Guide HTML 资产语言和正文真实不同。
- `pnpm test` 通过：28 files / 112 tests。
- `pnpm typecheck`、`pnpm lint`、两个 Next.js 16 production build 与 `git diff --check` 通过。
- NAS 运行态下 `i18n.spec.ts`、`system-guide.spec.ts`、`main-flow.spec.ts` 合并验收 8/8 通过；主流程完成 Admin 建档到不可变 Review correction 和审计闭环。
- 检查同时定位到上一状态机迁移新增的 `egocapture.state_machine_transitions` 未启用 RLS；该缺口必须以独立 additive migration 修复，不混入 i18n 提交。
