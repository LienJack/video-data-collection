# Implementation Plan

## Foundation

- [ ] 建立 locales、negotiation、catalog type、translator、interpolation、Intl formatter 及测试。
- [ ] 建立 UI Provider、server adapters、locale Route Handler 和 LanguageSwitcher。
- [ ] 在两个 root layout 设置 locale、`html lang`、metadata 与 catalog provider。

## Coverage Migration

- [ ] 先迁移共享导航、登录、错误/404/loading、状态/动作标签和通用组件。
- [ ] 迁移 Participant 的任务、Session、marker、上传队列及邀请流程。
- [ ] 迁移 Admin 的 dashboard、participants/devices、tasks、sessions、review、records/audit。
- [ ] 迁移系统指南正文和三语言 diagram source/assets。
- [ ] 将 DomainError/Zod/客户端异常展示改为 code→localized message。

## Formatting and Guardrails

- [ ] 替换散落的 date/number/region formatting 为共享 helpers。
- [ ] 添加 catalog key parity 和插值参数测试。
- [ ] 添加应用硬编码用户文案扫描，建立窄而有注释的技术字符串豁免。

## Validation

- [ ] `pnpm test -- tests/unit/i18n.test.ts tests/unit/regional-preferences.test.tsx`
- [ ] `pnpm i18n:check`
- [ ] `pnpm typecheck && pnpm lint && pnpm build`
- [ ] `pnpm test:e2e -- tests/e2e/i18n.spec.ts tests/e2e/main-flow.spec.ts tests/e2e/system-guide.spec.ts`
- [ ] 在三种语言中检查语言持久化、查询参数、错误文案、状态标签和 `<html lang>`。
- [ ] `git diff --check`；显式暂存 i18n、两个 App、UI、生成图表和测试路径，排除并行任务文件。

## Dependency and Rollback

- 状态机 child commit 必须先完成，以便 catalog 使用稳定 machine/state/error keys。
- 当前 participant drawer/task-detail 并行改动必须先独立提交，避免翻译提交隐式吞入未跟踪组件。
- 本子任务不重置数据、不创建云项目。
