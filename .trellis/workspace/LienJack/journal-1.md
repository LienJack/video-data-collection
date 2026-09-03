# Journal - LienJack (Part 1)

> AI development session journal
> Started: 2026-09-02

---



## Session 1: 完成两步式参与者选择弹窗

**Date**: 2026-09-02
**Task**: 完成两步式参与者选择弹窗
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

居中桌面弹窗并保留移动端底部弹层；新增人员与设备设置两步切换、地区多选、独立滚动区域及覆盖布局、键盘、状态保留和提交行为的定向 E2E。

### Git Commits

| Hash | Message |
|------|---------|
| `0154976` | (see git log) |

### Status

[OK] **Completed**


## Session 2: 落地采集记录工作台

**Date**: 2026-09-02
**Task**: 落地采集记录工作台
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

将管理员上传、录制会话和审计列表收敛为 /records 三页签工作台，补齐异常汇总、延迟上传追溯、兼容重定向、共享中文呈现器与聚焦验收。

### Git Commits

| Hash | Message |
|------|---------|
| `5030d41` | (see git log) |

### Status

[OK] **Completed**


## Session 3: Deliver Admin system documentation center

**Date**: 2026-09-02
**Task**: Deliver Admin system documentation center
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Added the Admin-only system guide entry and four Chinese technical articles, delivered four validated Archify diagrams with browser evidence, documented the same-origin iframe security contract, and verified the feature with full checks plus focused Playwright coverage.

### Git Commits

| Hash | Message |
|------|---------|
| `6f65fae` | (see git log) |

### Status

[OK] **Completed**


## Session 4: Unified admin table pagination

**Date**: 2026-09-02
**Task**: Unified admin table pagination
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Unified seven admin data lists on semantic tables and page-number pagination, added shared URL/UI/core contracts, migrated services from cursors, and verified unit, build, integration, and NAS Chromium flows.

### Git Commits

| Hash | Message |
|------|---------|
| `50527a7` | (see git log) |

### Status

[OK] **Completed**


## Session 5: Participant login credential management

**Date**: 2026-09-02
**Task**: Participant login credential management
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Added admin-readable plaintext participant credentials in an isolated server-only table, system-generated passwords, invitation acceptance without password entry, recoverable Supabase reset synchronization, and NAS-backed authorization/leakage/integration tests.

### Git Commits

| Hash | Message |
|------|---------|
| `96709ec` | (see git log) |

### Status

[OK] **Completed**


## Session 6: 系统指南业务流程与超大文件上传设计

**Date**: 2026-09-02
**Task**: 系统指南业务流程与超大文件上传设计
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

将系统说明第 02、03 章改为 Leader 向业务叙事，补齐管理员/参与者采集闭环、当前 TUS 与未来 Multipart 的分片暂停恢复设计；重做两张 Archify 图并通过仓库、浏览器和图表验收。

### Git Commits

| Hash | Message |
|------|---------|
| `b9e4fe8` | (see git log) |

### Status

[OK] **Completed**


## Session 7: Bind participant uploads to Session QR

**Date**: 2026-09-03
**Task**: Bind participant uploads to Session QR
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Displayed signed Session QR codes on participant task details, added Session-scoped upload entry, locked and server-validated upload context, protected cross-Session resume state, and preserved the generic upload fallback.

### Git Commits

| Hash | Message |
|------|---------|
| `2bcbb0f` | (see git log) |

### Status

[OK] **Completed**


## Session 8: Implement XState lifecycle state machines

**Date**: 2026-09-03
**Task**: Implement XState lifecycle state machines
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Planned the four-stage delivery program, documented unattended execution, implemented and independently reviewed XState v5 lifecycle machines, PostgreSQL transition guards, transactional service enforcement, and Participant upload actors; validated against NAS infrastructure with unit, integration, production build, and main-flow E2E checks.

### Git Commits

| Hash | Message |
|------|---------|
| `db04e24` | (see git log) |
| `1aa4644` | (see git log) |
| `ef8c38e` | (see git log) |

### Status

[OK] **Completed**


## Session 9: Complete zh en ja internationalization

**Date**: 2026-09-03
**Task**: Complete zh en ja internationalization
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Added typed zh-CN, English, and Japanese catalogs, locale negotiation and persistence, translated Admin and Participant surfaces plus System Guide assets, and verified unit, type, lint, build, and NAS-backed browser flows while preserving parallel drawer work.

### Git Commits

| Hash | Message |
|------|---------|
| `0145783` | (see git log) |

### Status

[OK] **Completed**


## Session 10: Harden state machine registry RLS

**Date**: 2026-09-03
**Task**: Harden state machine registry RLS
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Added migration 0024 to enable RLS on the lifecycle registry without policies or grants, added static all-business-table coverage, preserved 14 machines and 133 edges, and restored all NAS checks.

### Git Commits

| Hash | Message |
|------|---------|
| `c2228c9` | (see git log) |

### Status

[OK] **Completed**


## Session 11: Deterministic multi-region demo data

**Date**: 2026-09-03
**Task**: Deterministic multi-region demo data
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Added guarded dedicated-environment refresh across PostgreSQL, Supabase Auth and Storage; seeded stable CN/US/JP fixtures and scenario coverage; verified repeatable NAS digest, RLS, Chromium/WebKit flows, static checks and preserved unrelated parallel UI work.

### Git Commits

| Hash | Message |
|------|---------|
| `070462c` | (see git log) |

### Status

[OK] **Completed**


## Session 12: Deploy EgoCapture production stack

**Date**: 2026-09-03
**Task**: Deploy EgoCapture production stack
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Deployed Participant and Admin to Vercel sfo1 with dedicated Supabase us-west-1, rotated demo Auth credentials, passed final public 4/4 and deterministic baseline/RLS/Storage restore, documented the scoped database-password rotation HOLD, and preserved unrelated UI work.

### Git Commits

| Hash | Message |
|------|---------|
| `dd6aa59` | (see git log) |
| `bcb6f4a` | (see git log) |
| `fdf3495` | (see git log) |
| `0af0f08` | (see git log) |
| `a88d66b` | (see git log) |
| `1cc77e6` | (see git log) |
| `e5d790a` | (see git log) |
| `6278d6e` | (see git log) |
| `4e6422c` | (see git log) |
| `3ca9b88` | (see git log) |
| `6fb1be8` | (see git log) |
| `a69858e` | (see git log) |
| `98ee875` | (see git log) |

### Status

[OK] **Completed**


## Session 13: Complete state machine i18n demo deployment

**Date**: 2026-09-03
**Task**: Complete state machine i18n demo deployment
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

Closed AC1-AC6 after final repository, NAS and public integration gates; validated archived child context references, recorded the scoped database-password HOLD and US-latency SKIP, archived the five-child parent task, and preserved unrelated participant UI work.

### Git Commits

| Hash | Message |
|------|---------|
| `585a728` | (see git log) |

### Status

[OK] **Completed**


## Session 14: 重写 EgoCapture 架构与大文件上传 README

**Date**: 2026-09-03
**Task**: 重写 EgoCapture 架构与大文件上传 README
**Package**: admin-web
**Branch**: `codex/egocapture-mvp`

### Summary

删除交付状态与部署流水，将 README 重写为面向工程师和项目 Leader 的系统设计文档；补充 8 张 Mermaid 图、完整采集业务流程、身份匹配证据链、TUS 断点续传细节与生产级 Multipart 演进，并通过 Mermaid 渲染、仓库安全和完整 pnpm check。

### Git Commits

| Hash | Message |
|------|---------|
| `72ba72c` | (see git log) |

### Status

[OK] **Completed**
