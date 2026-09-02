# 中英日国际化

## Goal

让 Admin 与 Participant 两个应用的完整用户界面支持简体中文、英文、日语，并在不改变现有业务 URL 和持久化状态键的前提下提供一致、可持续维护的本地化体验。

## Background

- 当前两端页面、表单、错误、状态标签和系统指南存在大量硬编码中文及少量混合英文。
- `participants.locale` 保存任意合法 BCP 47 locale；UI 支持集必须与业务偏好字段区分。
- Next.js 16.3.4 本地文档要求 `cookies()` 异步读取，并给出字典式本地化方案；本任务不引入语言路径前缀，避免改写现有邀请、任务、Session 和上传 URL。
- 本任务在状态机子任务完成后实施，以状态 machine/state/error code 作为翻译键。

## Requirements

### Locale contract

- UI locale 固定为 `zh-CN`、`en`、`ja`，默认 `zh-CN`。
- 解析顺序：用户显式选择 Cookie → Participant 登录时同步的 profile locale 映射 → 首次请求 `Accept-Language` → 默认中文。
- `zh-*` 映射 `zh-CN`，`en-*` 映射 `en`，`ja-*` 映射 `ja`；其他语言回退中文。
- 语言选择使用 host-only、SameSite=Lax Cookie 持久化，并刷新当前 URL，不丢失查询参数。

### Translation coverage

- 翻译两个应用的登录、导航、仪表盘、参与者、设备、任务、Session、上传、Review、Records、Audit、空/加载/错误/404 页面和所有主要表单。
- 翻译状态标签、状态动作、DomainError/API error code、Zod/表单校验和客户端上传错误。
- 翻译系统指南 React 正文、可访问名称以及嵌入式图表文字；每种语言加载对应静态图表资源。
- 管理员编写的 Task instructions 和参与者自由文本保持原始内容，不自动机器翻译。

### Formatting and metadata

- `<html lang>`、页面 title/description、日期、时间、数字、字节、时长和国家/语言显示名使用当前 UI locale。
- 原始 ISO 时间、状态键、public id、对象 key 和审计 payload 不本地化。

### Maintainability

- 三个目录共享同一类型化 key 结构，支持插值和基本复数；缺 key 在构建/测试阶段失败。
- Server Components 与 Client Components 复用同一 catalog 契约；客户端只通过 Provider/translator 获取文案。
- 新增检查阻止核心应用代码继续增加未豁免的硬编码用户文案。

## Acceptance Criteria

- [ ] 两个应用均可在 `zh-CN`、`en`、`ja` 间切换，刷新、导航和登录后保持语言。
- [ ] 三种语言下 `<html lang>`、metadata、日期/数字/地区显示正确。
- [ ] 核心 Admin→Participant→Upload→Review 流程没有缺失 key 或意外混合语言 UI。
- [ ] 状态机键和 API error code 在三种语言中都有可读标签，数据库原始值保持不变。
- [ ] 系统指南正文和嵌入图表按所选语言显示，可访问 title/alt 同步变化。
- [ ] 翻译 key 等价检查、硬编码扫描、单元测试、生产构建和三语言 Playwright 用例通过。

## Out of Scope

- 自动翻译管理员或参与者输入的业务内容。
- 为三种语言分别建立 URL 前缀、SEO hreflang 或独立域名。
- 在本任务中新增更多 UI 语言。
