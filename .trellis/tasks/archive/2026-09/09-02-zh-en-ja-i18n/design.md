# Technical Design

## Shared Catalog

在 core 增加纯 TypeScript i18n 契约：supported locales、locale negotiation、nested message catalog、typed key、interpolation 和 Intl formatter。中文 catalog 是 schema 基准，英文与日文使用 `satisfies`/递归测试保持完全同构。

UI package 提供 `I18nProvider`、`useTranslations` 和 `LanguageSwitcher`。Server Components 直接通过当前 locale 创建 translator；Client Components 从 Provider 读取 catalog。不得在 API/数据库层翻译状态。

## Locale Resolution

```text
explicit locale cookie
  -> participant profile locale mapped on successful login
  -> Accept-Language negotiation
  -> zh-CN fallback
```

每个 App 的 root layout 异步读取 Cookie/headers，设置 `<html lang>` 并提供 catalog。切换器调用 same-origin Route Handler 写入安全 Cookie，然后 `router.refresh()`；不改变路径，因此邀请 token 和当前查询条件不受影响。

## Error Boundary

- Domain/API errors expose stable code + safe parameters.
- 页面/客户端用 `errors.<code>` 查找翻译，未知 code 使用 localized generic fallback，并可在开发日志中保留 code。
- Zod schema 不再把某一种语言当作契约；表单根据 issue code/path 映射 message key。

## Status and Formatting

- 状态显示 key 由 `state.<machine>.<state>` 组成；动作 key 由 `stateAction.<machine>.<event>` 组成。
- Intl helpers 统一日期、相对时间、数字、字节、时长、region/language name。
- `participants.locale` 可以为 `en-US`/`ja-JP` 等，先映射到 UI locale，再用于更具体的业务时间格式时保留原值。

## System Guide Assets

React 正文进入 catalog；diagram source 为每种 locale 提供文本数据并生成 `public/system-guide/diagrams/<locale>/...` HTML/visual snapshots。页面按当前 locale 选择 iframe 和可访问描述；CSP namespace 保持原有窄范围。

## Rollback

保留稳定 URL 和默认中文。若某页面迁移失败，可在同一 catalog 架构内先回退到中文 key，不恢复硬编码。Cookie 删除后自然回到协商/default；数据库无需回滚。
