# System Guide Acceptance Evidence

## Product verification

- `pnpm check`: PASS.
  - lint: PASS;
  - strict type checks: PASS for the root, Participant Web, and Admin Web;
  - Vitest: PASS, 18 files / 64 tests;
  - production builds: PASS for Participant Web and Admin Web; `/system-guide` is present in the Admin route manifest.
- `pnpm exec playwright test tests/e2e/system-guide.spec.ts --project=chromium`: PASS, 4/4.
  - anonymous `/system-guide` access redirects to Admin login;
  - the desktop upper-right entry opens the guide;
  - all four articles, anchors, iframe documents, `SAMEORIGIN` and `frame-ancestors 'self'` are verified;
  - the mobile entry keeps a 44 px target and the existing five-item primary navigation;
  - Participant Web exposes no system-guide entry.
- `git diff --check`: PASS.
- `pnpm repo:safety`: BLOCKED by an unrelated concurrent pagination task deleting `packages/core/src/server/cursor.ts`; this task does not own or revert that file.

## Archify artifact receipts

All four source specifications pass showcase validation with 9/9 checks, 0 errors, and 0 warnings. Each final HTML then passes artifact-bound browser `visual-check` containment/readability/capture checks. Each candidate used one correction round.

| Diagram | Final HTML SHA-256 | Browser evidence | Independent visual review |
|---|---|---|---|
| System architecture | `aa567d03b8f280a92d8582c2599352ecfef133dd11a2f49334ba59bf479c8059` | PASS | PASS |
| Admin/Participant workflow | `9840f962810a40234a65db03f633a9ddb66c129a164e2b89cbe30bffc0b616c3` | PASS | PASS |
| Multipart resume | `132f0275969090754b803ab7841a65bc0e79e82694bf317314e2346ee2583515` | PASS | PASS |
| Live recording | `7c83c8ee1b8638112de25a1c18d00ab619c863f032b7bf01d8485809ce431c0d` | PASS | PASS |

The Archify sidecar field `visualReview: pending` is intentionally left unchanged by contract. The independent review above was performed with image-capable inspection of the final 1440x900 light/dark and 2048x1320 evidence captures.

## Product perceptual review

- `system-guide-desktop.png` at 1440x900: PASS. The upper-right entry, hero, status distinctions, sticky table of contents, and first article hierarchy are clear with no horizontal clipping.
- `system-guide-mobile.png` at 390x844: PASS. The compact guide icon remains visible beside “全部功能”, the table of contents becomes horizontal, the article stays readable, and the five-item bottom navigation remains unchanged.

These screenshots are evidence of the product shell and documentation layout. Archify diagram screenshots remain separate evidence for standalone diagram rendering.
