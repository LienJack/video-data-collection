# 参与者查看与编辑侧边栏技术设计

## Component boundary

`/participants` 保持 Server Component，继续在服务端取得分页列表。每行操作列挂载轻量 Client Component，只接收 Participant ID、Fixture 标记等摘要；完整资料和凭据在用户点击“查看”或“编辑”后，通过受 admin 保护的单参与者详情 API 按需加载。

这样可以保证：

- 批量列表 HTML/Flight payload 不含密码或完整资料。
- 初始列表仍由服务端渲染并保留统一分页 URL。
- Drawer 关闭后清空详情与密码状态，下一次打开重新读取当前值。
- 编辑成功调用 `router.refresh()`，保留当前 `page` 与筛选 URL 并刷新服务端行数据。

## Drawer interaction

使用原生 `<dialog>.showModal()` 构建固定在右侧的 drawer，不新增全局状态库：

- 桌面宽度限制约 36rem；窄屏占满可用宽度和高度。
- `aria-labelledby` 连接当前模式标题；原生 modal 语义与 focus containment 生效。
- 关闭按钮、Escape (`onCancel`) 和 backdrop click 均走同一个 close 函数。
- 打开时记录触发按钮；关闭完成后显式恢复焦点。
- 打开时锁定页面背景滚动，unmount/关闭时恢复原样。
- loading、fetch error、view、edit 四种内容状态在 drawer 内切换，不因请求失败自动关闭。

每行保留 Participant ID 详情页链接。“查看”和“编辑”按钮有独立可识别名称，例如“查看 PT-…”与“编辑 PT-…”。

## View model

查看态展示：

- Participant ID、Alias、状态、Consent、Fixture。
- 管理邮箱、国家/地区、Locale、时区、默认设备、备注。
- 登录地址、登录帐号（Participant ID）、当前密码、凭据状态。

凭据行为：

- 帐号、密码分别有复制按钮。
- `ready` 时提供“一键复制登录信息”，文案固定包含登录地址、帐号和密码。
- `pending_activation` 可显示/复制密码，但明确提示必须先接受邀请；提供到完整详情页的入口处理邀请。
- `missing` 显示“生成登录密码”；`pending_sync` 显示恢复提示与“继续同步”。
- 已有凭据显示“重置登录密码”。操作前使用确认 dialog/二次确认文案说明旧密码立即失效；Fixture 保护时按钮禁用并解释原因。
- Clipboard API 成功后使用 aria-live 状态提示；失败时保留可选中文本并显示可操作错误。

## Edit model

编辑态只包含 Alias、管理邮箱、国家/地区、Locale、时区、备注。表单使用详情响应的 `updatedAt` 作为 `expectedUpdatedAt`：

- submit 期间禁用按钮，防止重复 PATCH。
- API 校验错误、网络失败、409 乐观锁冲突在 drawer 内显示。
- 成功后关闭 drawer、清空敏感状态并 `router.refresh()`。
- Fixture 保护时可进入查看，但编辑表单不可保存并显示原因。
- 状态、Consent、邀请、设备和退出研究不在编辑态中出现。

## API contracts consumed

- `GET /api/admin/participants/[id]`：完整资料、`updatedAt` 和 `loginCredential`；no-store。
- `PATCH /api/admin/participants/[id]`：复用现有资料更新 schema。
- `POST /api/admin/participants/[id]/credentials/reset`：生成、初始化或重试同步当前凭据；Trusted Origin、admin、idempotency 和 Fixture 保护由凭据子任务实现。

Client 不持久化响应，不把密码放入 URL、analytics、console 或错误文本。

## Coexistence with pagination

- 操作列由 drawer 子任务追加到分页子任务已统一的 Participants Table。
- 打开 drawer 不修改 URL，关闭也不触发导航。
- PATCH/凭据 reset 后只刷新当前 route；`page`、search、status、Consent、Locale、Region、Missing、Review 参数均保留。
- 筛选/翻页导致当前行卸载时，row component cleanup 关闭 dialog 并清空详情。

## Verification

- 组件测试：打开模式、loading/error、字段、复制文本、reset 确认、fixture disabled、PATCH payload。
- 可访问性：标题、modal、Escape、backdrop、焦点返回、aria-live、键盘触发。
- E2E：在非第 1 页或带筛选 URL 打开/关闭/编辑，保存后 URL 和列表值正确；ready 凭据复制值可用于 participant 登录。
- 320/390px 窄屏无横向溢出，表格本身仍在外层横向滚动。

## Rollback

Drawer 是独立客户端入口。回退本子任务删除操作列与组件即可，参与者详情页、统一分页和后台凭据能力仍可独立工作。
