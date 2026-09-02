# Technical Design

## Reset Command

新增 `db:demo:refresh`，内部拆为 inspect、purge、seed、verify 四阶段：

```text
resolve exact environment identity
  -> inspect database/auth/storage counts
  -> require --execute + matching confirmation
  -> delete bucket objects
  -> truncate explicit egocapture business tables in one transaction
  -> delete captured/marked Auth users
  -> deterministic seed
  -> integrity + idempotency verification
```

默认 dry-run。确认值不是固定通用短语，而是环境中配置的 `EGOCAPTURE_ENVIRONMENT_ID`；输出只含 identity 和计数，不含密码、JWT 或对象签名 URL。清理使用显式表清单，不 drop schema、不删 migration ledger、不碰其他 bucket。

## Catalog Model

在 `scripts/fixtures/` 建立纯数据 catalog 和 builders：

- regions: CN/zh-CN/Asia/Shanghai、US/en-US/America/Los_Angeles、JP/ja-JP/Asia/Tokyo。
- people: 每区 6 个经人工审阅的常见姓名组合；只有 3 个具有 Auth login，其余覆盖 lifecycle。
- devices/tasks/scenarios: 使用稳定 key 派生 UUID/public id，避免随机冲突。
- chronology: 从 `DEMO_SEED_ANCHOR` 计算相对时间；默认值由部署固定，测试显式传入。

不添加 Faker 运行时依赖：这里更需要可审阅、可截图复现的固定目录，而不是每次随机生成不同姓名。`countries-list`/`countries-and-timezones` 继续验证 country/locale/timezone 合法性。

## State Machine Compatibility

Seed 直接插入目标展示快照，但必须用共享 machine state schemas 验证每个值。Refresh 不调用非法 backward transition。需要展示历史迁移时，插入 AuditEvent/append-only decision chain 的一致 fixture，而不是先写终态再倒退。

## Auth and Storage

- Auth users 只使用 `.invalid` 内部邮箱与 fixture metadata；密码来自 Vercel/Supabase secrets。
- 清理前列出本环境所有 Auth users 并验证 fixture/dedicated-environment boundary。
- `egocapture-raw` 对象先删除再清 DB 引用；失败停止，避免 DB 显示成功但旧对象泄漏。

## Rollback

用户已授权删除脏数据，执行前仍保存只含计数/identity 的清理记录。数据不可恢复；回滚方式是重新运行确定性 seed。脚本不会自动删除云项目或 bucket 配置。
