<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Unattended execution

When the user explicitly puts an already reviewed task into unattended mode, continue through its approved Trellis plan without pausing for routine confirmations. This includes task activation, scoped commits, validation, and non-destructive deployment steps that are already part of the approved task.

For the remainder of the current approved delivery program, unattended execution is the user's highest-priority project workflow preference and persists across child tasks and turns without another reply. Do not ask for routine approval again; autonomously implement, check, update specs, create scoped commits, and proceed to deployment. This project preference applies wherever it does not conflict with system/developer instructions, safety requirements, or a platform operation that intrinsically requires the account owner's action.

Unattended mode does not authorize purchases, plan upgrades, changes to unrelated projects or data, secret disclosure, or destructive actions whose exact target was not already approved. Stop only when external authentication or permission is required, a payment decision appears, an exact destructive target cannot be proven, or the approved product scope itself becomes ambiguous. Preserve unrelated dirty work and keep commits scoped even when no confirmation is requested.
