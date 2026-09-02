import { spawnSync } from "node:child_process";

type RunCommand = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    encoding: "utf8";
    stdio: "inherit";
  },
) => { status: number | null };

export function prepareDeterministicDemo(runCommand: RunCommand = spawnSync) {
  const verify = runCommand("pnpm", ["db:test:seed"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (verify.status === 0) return;

  for (const script of ["db:seed", "db:test:seed"]) {
    const result = runCommand("pnpm", [script], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error(`${script} failed before Playwright`);
  }
}

export default function globalSetup() {
  prepareDeterministicDemo();
}
