import { randomBytes } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createConnection } from "node:net";
import path from "node:path";
import process from "node:process";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

type Profile = "local" | "nas";

const root = process.cwd();
const infraDirectory = path.join(root, "infra", "nas");
const runtimeDirectory = path.join(root, ".runtime");
const localConfigPath = path.join(root, ".env.development.local");

function parseEnv(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function readOptionalEnv(file: string): Record<string, string> {
  try {
    return parseEnv(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

const fileConfig = readOptionalEnv(localConfigPath);
const config = { ...fileConfig, ...process.env };
const nasHost = config.NAS_SSH_HOST || "";
const nasRoot = config.NAS_REMOTE_ROOT || "";
const nasApiPort = Number(config.NAS_API_PORT || 56521);
const nasDbPort = Number(config.NAS_DB_PORT || 56522);
const expectedNasServices = ["api-gateway", "auth", "db", "rest", "storage"];

function validateConfiguration() {
  if (!nasHost) throw new Error("NAS 模式必须在 .env.development.local 设置 NAS_SSH_HOST");
  if (!nasRoot) throw new Error("NAS 模式必须在 .env.development.local 设置 NAS_REMOTE_ROOT");
  if (!/^[A-Za-z0-9._-]+$/.test(nasHost)) throw new Error("NAS_SSH_HOST 包含不安全字符");
  if (
    !nasRoot.startsWith("/vol1/") ||
    nasRoot.split("/").filter(Boolean).length < 4 ||
    /['"`$]/.test(nasRoot)
  ) {
    throw new Error("NAS_REMOTE_ROOT 必须是 /vol1 下的专属项目目录且不能包含 shell 字符");
  }
  for (const port of [nasApiPort, nasDbPort]) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`无效端口 ${port}`);
  }
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string; quiet?: boolean } = {},
) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: "utf8",
    input: options.input,
    stdio: options.quiet
      ? "pipe"
      : [options.input ? "pipe" : "inherit", "inherit", "inherit"],
  });
  if (result.status !== 0) throw new Error(`${command} 执行失败，退出码 ${result.status ?? "unknown"}`);
  return result.stdout?.trim() ?? "";
}

function ssh(script: string, options: { input?: string; quiet?: boolean } = {}) {
  return run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", nasHost, script], options);
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

async function isPortFree(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

async function requireFreeLocalPorts() {
  for (const port of [nasApiPort, nasDbPort]) {
    if (!(await isPortFree(port))) throw new Error(`Mac 端口 ${port} 已被占用；不会终止未知进程`);
  }
}

async function createSecrets(profile: Profile) {
  const secret = randomBytes(48).toString("base64url");
  const encodedSecret = new TextEncoder().encode(secret);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 10 * 365 * 24 * 60 * 60;
  const signRole = (role: "anon" | "service_role") =>
    new SignJWT({ role })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("supabase-demo")
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(encodedSecret);
  const [anonKey, serviceKey] = await Promise.all([signRole("anon"), signRole("service_role")]);
  const dbPassword = randomBytes(32).toString("base64url");
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
  const markerPrivate = JSON.stringify(await exportJWK(privateKey));
  const markerPublic = JSON.stringify(await exportJWK(publicKey));
  const apiPort = profile === "nas" ? nasApiPort : 54321;
  const dbPort = profile === "nas" ? nasDbPort : 54322;
  const projectName = profile === "nas" ? "egocapture-dev" : "egocapture-local";

  const compose = [
    `COMPOSE_PROJECT_NAME=${projectName}`,
    `POSTGRES_PASSWORD=${dbPassword}`,
    `JWT_SECRET=${secret}`,
    `ANON_KEY=${anonKey}`,
    `SERVICE_ROLE_KEY=${serviceKey}`,
    `S3_PROTOCOL_ACCESS_KEY_ID=${randomBytes(16).toString("hex")}`,
    `S3_PROTOCOL_ACCESS_KEY_SECRET=${randomBytes(32).toString("hex")}`,
    `API_EXTERNAL_PORT=${apiPort}`,
    `DB_EXTERNAL_PORT=${dbPort}`,
    `SUPABASE_PUBLIC_URL=http://127.0.0.1:${apiPort}`,
    `API_EXTERNAL_URL=http://127.0.0.1:${apiPort}/auth/v1`,
    "SITE_URL=http://localhost:3000",
  ].join("\n") + "\n";

  const app = [
    `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${apiPort}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    `NEXT_PUBLIC_STORAGE_TUS_ENDPOINT=http://127.0.0.1:${apiPort}/storage/v1/upload/resumable`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
    `SUPABASE_JWT_SECRET=${secret}`,
    "STORAGE_UPLOAD_AUTH_MODE=nas_scoped_jwt",
    `DATABASE_URL=postgresql://postgres:${encodeURIComponent(dbPassword)}@127.0.0.1:${dbPort}/postgres`,
    "SITE_URL=http://localhost:3000",
    `MARKER_PRIVATE_KEY_JWK=${markerPrivate}`,
    `MARKER_PUBLIC_KEY_JWK=${markerPublic}`,
    "MARKER_KEY_ID=marker-key-v1",
    `STUDY_SERIAL_HMAC_KEY=${randomBytes(32).toString("base64url")}`,
    `CRON_SECRET=${randomBytes(32).toString("base64url")}`,
    `DEMO_ADMIN_PASSWORD=${randomBytes(18).toString("base64url")}`,
    `DEMO_PARTICIPANT_PASSWORD=${randomBytes(18).toString("base64url")}`,
  ].join("\n") + "\n";

  return { compose, app };
}

async function ensureRuntime(profile: Profile) {
  const directory = path.join(runtimeDirectory, profile);
  const composePath = path.join(directory, "compose.env");
  const appPath = path.join(directory, "app.env");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await access(composePath);
    await access(appPath);
  } catch {
    const secrets = await createSecrets(profile);
    await writeFile(composePath, secrets.compose, { mode: 0o600 });
    await writeFile(appPath, secrets.app, { mode: 0o600 });
  }
  await chmod(composePath, 0o600);
  await chmod(appPath, 0o600);
  const composeEnv = parseEnv(await readFile(composePath, "utf8"));
  const existingApp = await readFile(appPath, "utf8");
  const appEnv = parseEnv(existingApp);
  if (!appEnv.SUPABASE_JWT_SECRET || !appEnv.STORAGE_UPLOAD_AUTH_MODE) {
    const additions = [
      !appEnv.SUPABASE_JWT_SECRET ? `SUPABASE_JWT_SECRET=${composeEnv.JWT_SECRET}` : "",
      !appEnv.STORAGE_UPLOAD_AUTH_MODE ? "STORAGE_UPLOAD_AUTH_MODE=nas_scoped_jwt" : "",
    ].filter(Boolean).join("\n");
    await writeFile(appPath, `${existingApp.trimEnd()}\n${additions}\n`, { mode: 0o600 });
  }
  return {
    directory,
    composePath,
    appPath,
    appEnv: parseEnv(await readFile(appPath, "utf8")),
  };
}

async function checkNasCapacity() {
  validateConfiguration();
  const result = ssh(
    `set -eu
available_kb=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
available_disk_kb=$(df -Pk /vol1 | awk 'NR==2 {print $4}')
test "$available_kb" -ge 3145728
test "$available_disk_kb" -ge 20971520
command -v docker >/dev/null
docker compose version >/dev/null
for port in ${nasApiPort} ${nasDbPort}; do
  if ss -ltnH "sport = :$port" | grep -q .; then
    docker ps --format '{{.Labels}}' | grep -q 'com.docker.compose.project=egocapture-dev' || exit 44
  fi
done
printf 'memory_mb=%s disk_gb=%s' "$((available_kb / 1024))" "$((available_disk_kb / 1024 / 1024))"`,
    { quiet: true },
  );
  console.log(`NAS 资源检查通过：${result}`);
}

async function syncNas(runtime: Awaited<ReturnType<typeof ensureRuntime>>) {
  ssh(`mkdir -p ${shellQuote(`${nasRoot}/infra/nas`)}`);
  run("rsync", [
    "-az",
    "--delete",
    "--exclude",
    ".env",
    `${infraDirectory}/`,
    `${nasHost}:${nasRoot}/infra/nas/`,
  ]);
  const remoteEnv = `${nasRoot}/infra/nas/.env`;
  try {
    ssh(`test -f ${shellQuote(remoteEnv)}`, { quiet: true });
  } catch {
    const contents = await readFile(runtime.composePath, "utf8");
    ssh(`umask 077; cat > ${shellQuote(remoteEnv)}`, { input: contents, quiet: true });
  }
}

function remoteCompose(args: string[], options: { quiet?: boolean } = {}) {
  const command = [
    "cd",
    shellQuote(`${nasRoot}/infra/nas`),
    "&&",
    "docker",
    "compose",
    "--env-file",
    ".env",
    "-f",
    "compose.yaml",
    ...args.map(shellQuote),
  ].join(" ");
  return ssh(command, options);
}

function assertNasInfrastructureOnly() {
  const configured = remoteCompose(["config", "--services"], { quiet: true })
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  const expected = [...expectedNasServices].sort();
  if (configured.join("\n") !== expected.join("\n")) {
    throw new Error(
      `NAS Compose 只能包含基础设施服务 ${expected.join(", ")}；当前为 ${configured.join(", ")}`,
    );
  }

  const running = ssh(
    `docker ps --filter label=com.docker.compose.project=egocapture-dev --format '{{.Label "com.docker.compose.service"}}'`,
    { quiet: true },
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  const unexpected = running.filter((service) => !expected.includes(service));
  if (unexpected.length > 0) {
    throw new Error(`NAS egocapture-dev 项目混入非基础设施容器：${unexpected.join(", ")}`);
  }
}

function repairRemoteDatabaseRoles() {
  const sql = `ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

GRANT anon, authenticated, service_role TO supabase_storage_admin;

ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

CREATE SCHEMA IF NOT EXISTS egocapture AUTHORIZATION postgres;
GRANT USAGE ON SCHEMA egocapture TO anon, authenticated, service_role;
`;
  const command = [
    "cd",
    shellQuote(`${nasRoot}/infra/nas`),
    "&&",
    "set -a",
    "&&",
    ". ./.env",
    "&&",
    "set +a",
    "&&",
    "docker compose --env-file .env -f compose.yaml exec -T",
    "db psql -v ON_ERROR_STOP=1 -U postgres -d postgres",
    '-v pgpass="$POSTGRES_PASSWORD" -f -',
  ].join(" ");
  ssh(command, { input: sql });
}

function backupRemoteSchema() {
  const backupDirectory = path.posix.join(path.posix.dirname(nasRoot), "backups");
  const result = ssh(
    `set -eu
cd ${shellQuote(`${nasRoot}/infra/nas`)}
set -a
. ./.env
set +a
backup_dir=${shellQuote(backupDirectory)}
mkdir -p "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_dir/$timestamp.sql.gz"
docker compose --env-file .env -f compose.yaml exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_dump -U postgres -d postgres --schema=egocapture --no-owner --no-privileges \
  | gzip -9 > "$target"
test -s "$target"
set -- "$backup_dir"/*.sql.gz
if test -e "$1"; then
  ls -1t "$backup_dir"/*.sql.gz | awk 'NR > 5' | while IFS= read -r old_backup; do
    case "$old_backup" in
      "$backup_dir"/*.sql.gz) rm -- "$old_backup" ;;
      *) exit 78 ;;
    esac
  done
fi
printf '%s' "$target"`,
    { quiet: true },
  );
  console.log(`NAS schema 备份完成：${result}`);
}

function runDatabase(command: "migrate" | "verify", appEnv: Record<string, string>) {
  return run("pnpm", ["tsx", "scripts/database.ts", command], {
    env: { ...process.env, ...appEnv },
  });
}

function runPackageScript(
  script: "db:seed" | "db:test:seed" | "db:test:rls" | "auth:test",
  appEnv: Record<string, string>,
) {
  return run("pnpm", [script], { env: { ...process.env, ...appEnv } });
}

async function nasInfra() {
  const runtime = await ensureRuntime("nas");
  await checkNasCapacity();
  await syncNas(runtime);
  assertNasInfrastructureOnly();
  remoteCompose(["up", "-d", "--wait", "db"]);
  repairRemoteDatabaseRoles();
  remoteCompose(["up", "-d", "--wait", "--remove-orphans"]);
  assertNasInfrastructureOnly();
  const bindings = remoteCompose(["port", "api-gateway", "8000"], { quiet: true });
  if (!bindings.includes(`127.0.0.1:${nasApiPort}`)) {
    throw new Error(`NAS API 未绑定 loopback：${bindings}`);
  }
  console.log("开发拓扑：NAS Docker 仅运行 DB/Auth/REST/Storage/Gateway；Next.js 在 Mac 本地运行");
  console.log("NAS 最小 Supabase 栈已健康启动");
  return runtime;
}

async function nasMigrate() {
  const runtime = await nasInfra();
  backupRemoteSchema();
  await withNasTunnel(async () => {
    runDatabase("migrate", runtime.appEnv);
    runDatabase("verify", runtime.appEnv);
  });
}

async function nasSeed() {
  const runtime = await nasInfra();
  await withNasTunnel(async () => {
    runDatabase("verify", runtime.appEnv);
    runPackageScript("db:seed", runtime.appEnv);
    runPackageScript("db:test:seed", runtime.appEnv);
  });
}

async function nasSetup() {
  const runtime = await nasInfra();
  backupRemoteSchema();
  await withNasTunnel(async () => {
    await healthCheck(nasApiPort, runtime.appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    runDatabase("migrate", runtime.appEnv);
    runDatabase("verify", runtime.appEnv);
    runPackageScript("db:seed", runtime.appEnv);
    runPackageScript("db:test:seed", runtime.appEnv);
    runPackageScript("db:test:rls", runtime.appEnv);
    runPackageScript("auth:test", runtime.appEnv);
  });
}

function startTunnel(): ChildProcess {
  return spawn(
    "ssh",
    [
      "-N",
      "-T",
      "-o",
      "BatchMode=yes",
      "-o",
      "ExitOnForwardFailure=yes",
      "-o",
      "ServerAliveInterval=15",
      "-o",
      "ServerAliveCountMax=3",
      "-L",
      `127.0.0.1:${nasApiPort}:127.0.0.1:${nasApiPort}`,
      "-L",
      `127.0.0.1:${nasDbPort}:127.0.0.1:${nasDbPort}`,
      nasHost,
    ],
    { stdio: "inherit" },
  );
}

async function waitForPort(port: number, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortFree(port))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`等待端口 ${port} 超时`);
}

async function healthCheck(apiPort: number, apiKey: string) {
  for (const endpoint of ["/auth/v1/health", "/storage/v1/status"]) {
    const response = await fetch(`http://127.0.0.1:${apiPort}${endpoint}`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`${endpoint} 健康检查失败：${response.status}`);
  }
  console.log("Auth、Storage 和 API Gateway 协议检查通过");
}

async function stopChild(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 4_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function withNasTunnel<T>(callback: () => Promise<T>): Promise<T> {
  await requireFreeLocalPorts();
  const tunnel = startTunnel();
  try {
    await waitForPort(nasApiPort);
    await waitForPort(nasDbPort);
    return await callback();
  } finally {
    await stopChild(tunnel);
    for (const port of [nasApiPort, nasDbPort]) {
      if (!(await isPortFree(port))) throw new Error(`Tunnel 退出后端口 ${port} 仍有监听`);
    }
  }
}

async function localInfra() {
  const runtime = await ensureRuntime("local");
  run("docker", [
    "compose",
    "--env-file",
    runtime.composePath,
    "-f",
    path.join(infraDirectory, "compose.yaml"),
    "up",
    "-d",
    "--wait",
    "--remove-orphans",
  ]);
  await healthCheck(54321, runtime.appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return runtime;
}

async function localMigrate() {
  const runtime = await localInfra();
  runDatabase("migrate", runtime.appEnv);
  runDatabase("verify", runtime.appEnv);
}

async function localSeed() {
  const runtime = await localInfra();
  runDatabase("verify", runtime.appEnv);
  runPackageScript("db:seed", runtime.appEnv);
  runPackageScript("db:test:seed", runtime.appEnv);
}

async function localSetup() {
  const runtime = await localInfra();
  runDatabase("migrate", runtime.appEnv);
  runDatabase("verify", runtime.appEnv);
  runPackageScript("db:seed", runtime.appEnv);
  runPackageScript("db:test:seed", runtime.appEnv);
}

async function startNext(appEnv: Record<string, string>) {
  const next = spawn("pnpm", ["dev:web"], {
    cwd: root,
    env: { ...process.env, ...appEnv },
    stdio: "inherit",
  });
  const stop = (signal: NodeJS.Signals) => {
    if (next.exitCode === null) next.kill(signal);
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  const code = await new Promise<number>((resolve) =>
    next.once("exit", (value) => resolve(value ?? 1)),
  );
  if (code !== 0 && code !== 130 && code !== 143) throw new Error(`Next.js 退出码 ${code}`);
}

async function nasDev() {
  const runtime = await nasInfra();
  await requireFreeLocalPorts();
  const tunnel = startTunnel();
  let next: ChildProcess | undefined;
  let shutdownRequested = false;
  let cleanupPromise: Promise<void> | undefined;
  const cleanup = () => {
    cleanupPromise ??= (async () => {
      await stopChild(next);
      await stopChild(tunnel);
    })();
    return cleanupPromise;
  };
  const requestShutdown = () => {
    shutdownRequested = true;
    void cleanup();
  };
  process.once("SIGINT", requestShutdown);
  process.once("SIGTERM", requestShutdown);
  try {
    await waitForPort(nasApiPort);
    await waitForPort(nasDbPort);
    await healthCheck(nasApiPort, runtime.appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    runDatabase("verify", runtime.appEnv);
    next = spawn("pnpm", ["dev:web"], {
      cwd: root,
      env: { ...process.env, ...runtime.appEnv },
      stdio: "inherit",
    });
    const winner = await Promise.race([
      new Promise<{ source: string; code: number }>((resolve) =>
        next?.once("exit", (code) => resolve({ source: "Next.js", code: code ?? 1 })),
      ),
      new Promise<{ source: string; code: number }>((resolve) =>
        tunnel.once("exit", (code) => resolve({ source: "SSH Tunnel", code: code ?? 1 })),
      ),
    ]);
    if (!shutdownRequested && ![0, 130, 143].includes(winner.code)) {
      throw new Error(`${winner.source} 意外退出：${winner.code}`);
    }
  } finally {
    await cleanup();
  }
}

async function destroy(profile: Profile) {
  if (process.env.EGOCAPTURE_DESTROY_INFRA !== "YES") {
    throw new Error("销毁数据前必须设置 EGOCAPTURE_DESTROY_INFRA=YES");
  }
  if (profile === "nas") remoteCompose(["down", "-v", "--remove-orphans"]);
  else {
    const runtime = await ensureRuntime("local");
    run("docker", [
      "compose",
      "--env-file",
      runtime.composePath,
      "-f",
      path.join(infraDirectory, "compose.yaml"),
      "down",
      "-v",
      "--remove-orphans",
    ]);
  }
}

async function main() {
  const command = process.argv[2] ?? "dev";
  if (command === "dev") {
    const profile = (config.EGOCAPTURE_DEV_PROFILE || "local") as Profile;
    if (profile === "nas") return nasDev();
    const runtime = await localInfra();
    return startNext(runtime.appEnv);
  }
  if (command === "nas:setup") return void (await nasSetup());
  if (command === "nas:infra") return void (await nasInfra());
  if (command === "nas:migrate") return void (await nasMigrate());
  if (command === "nas:seed") return void (await nasSeed());
  if (command === "nas:check") {
    await nasInfra();
    const runtime = await ensureRuntime("nas");
    return void (await withNasTunnel(async () => {
      await healthCheck(nasApiPort, runtime.appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      runDatabase("verify", runtime.appEnv);
      runPackageScript("db:test:rls", runtime.appEnv);
      runPackageScript("auth:test", runtime.appEnv);
    }));
  }
  if (command === "nas:tunnel") {
    await requireFreeLocalPorts();
    const child = startTunnel();
    await new Promise((resolve) => child.once("exit", resolve));
    return;
  }
  if (command === "nas:dev") return nasDev();
  if (command === "nas:down") return void remoteCompose(["down", "--remove-orphans"]);
  if (command === "nas:destroy") return void (await destroy("nas"));
  if (command === "local:setup") return void (await localSetup());
  if (command === "local:infra") return void (await localInfra());
  if (command === "local:migrate") return void (await localMigrate());
  if (command === "local:seed") return void (await localSeed());
  if (command === "local:dev") {
    const runtime = await localInfra();
    return startNext(runtime.appEnv);
  }
  if (command === "local:down") {
    const runtime = await ensureRuntime("local");
    return void run("docker", [
      "compose",
      "--env-file",
      runtime.composePath,
      "-f",
      path.join(infraDirectory, "compose.yaml"),
      "down",
      "--remove-orphans",
    ]);
  }
  if (command === "local:destroy") return void (await destroy("local"));
  throw new Error(`未知命令：${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture infra: ${error.message}` : error);
  process.exitCode = 1;
});
