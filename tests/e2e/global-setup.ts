import { spawnSync } from "node:child_process";

export default function globalSetup() {
  for (const script of ["db:seed", "db:test:seed"]) {
    const result = spawnSync("pnpm", [script], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error(`${script} failed before Playwright`);
  }
}
