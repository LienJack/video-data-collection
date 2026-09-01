import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

type Migration = {
  version: string;
  name: string;
  filename: string;
  checksum: string;
  sql: string;
};

const root = process.cwd();
const migrationsDirectory = path.join(root, "database", "migrations");

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

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const localConfig = readOptionalEnv(path.join(root, ".env.development.local"));
  const profile = process.env.EGOCAPTURE_DEV_PROFILE || localConfig.EGOCAPTURE_DEV_PROFILE || "local";
  const runtime = readOptionalEnv(path.join(root, ".runtime", profile, "app.env"));
  if (!runtime.DATABASE_URL) {
    throw new Error(`找不到 ${profile} profile 的 DATABASE_URL；请先运行对应 setup/infra 命令`);
  }
  return runtime.DATABASE_URL;
}

async function migrations(): Promise<Migration[]> {
  const files = (await readdir(migrationsDirectory))
    .filter((filename) => /^\d{4}_[a-z0-9_]+\.sql$/.test(filename))
    .sort();
  if (files.length === 0) throw new Error("没有找到 Migration 文件");
  return await Promise.all(
    files.map(async (filename) => {
      const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
      const [version, ...nameParts] = filename.replace(/\.sql$/, "").split("_");
      return {
        version,
        name: nameParts.join("_"),
        filename,
        checksum: createHash("sha256").update(sql).digest("hex"),
        sql,
      };
    }),
  );
}

async function ledgerExists(db: postgres.Sql): Promise<boolean> {
  const [row] = await db<{ exists: boolean }[]>`
    select to_regclass('egocapture.schema_migrations') is not null as exists
  `;
  return row.exists;
}

async function bootstrapLedger(db: postgres.Sql) {
  const [schema] = await db<{ exists: boolean }[]>`
    select exists(select 1 from pg_namespace where nspname = 'egocapture') as exists
  `;
  if (schema.exists && !(await ledgerExists(db))) {
    const [objects] = await db<{ object_count: number }[]>`
      select (
        (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'egocapture')
        + (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'egocapture')
      )::integer as object_count
    `;
    if (objects.object_count > 0) {
      throw new Error("HOLD: egocapture schema 已存在非本项目对象，拒绝接管或覆盖");
    }
  }

  await db.unsafe(`
    create schema if not exists egocapture authorization postgres;
    create table if not exists egocapture.schema_migrations (
      version text primary key check (version ~ '^[0-9]{4}$'),
      name text not null,
      checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
      execution_ms integer not null check (execution_ms >= 0),
      applied_at timestamptz not null default now()
    );
    revoke all on egocapture.schema_migrations from public, anon, authenticated;
  `);
}

async function appliedMigrations(db: postgres.Sql) {
  if (!(await ledgerExists(db))) return new Map<string, { checksum: string; name: string }>();
  const rows = await db<{ version: string; checksum: string; name: string }[]>`
    select version, checksum, name
    from egocapture.schema_migrations
    order by version
  `;
  return new Map(rows.map((row) => [row.version, row]));
}

function verifyHistory(files: Migration[], applied: Map<string, { checksum: string; name: string }>) {
  for (const [version, row] of applied) {
    const file = files.find((candidate) => candidate.version === version);
    if (!file) throw new Error(`已执行 Migration ${version} 缺少对应文件`);
    if (file.checksum !== row.checksum) {
      throw new Error(`已执行 Migration ${version} checksum 改变；禁止修改历史文件`);
    }
  }
}

async function migrate(db: postgres.Sql, files: Migration[]) {
  await db`select pg_advisory_lock(hashtext('egocapture.schema_migrations'))`;
  try {
    await bootstrapLedger(db);
    const applied = await appliedMigrations(db);
    verifyHistory(files, applied);
    for (const migration of files) {
      if (applied.has(migration.version)) continue;
      const startedAt = performance.now();
      await db.begin(async (transaction) => {
        await transaction.unsafe(migration.sql);
        const executionMs = Math.max(0, Math.round(performance.now() - startedAt));
        await transaction`
          insert into egocapture.schema_migrations (version, name, checksum, execution_ms)
          values (${migration.version}, ${migration.name}, ${migration.checksum}, ${executionMs})
        `;
      });
      console.log(`applied ${migration.filename} ${migration.checksum.slice(0, 12)}`);
    }
    await db.unsafe("notify pgrst, 'reload schema'");
  } finally {
    await db`select pg_advisory_unlock(hashtext('egocapture.schema_migrations'))`;
  }
}

async function reportStatus(db: postgres.Sql, files: Migration[], requireCurrent = false) {
  const applied = await appliedMigrations(db);
  verifyHistory(files, applied);
  const pending = files.filter((migration) => !applied.has(migration.version));
  for (const migration of files) {
    console.log(`${applied.has(migration.version) ? "applied" : "pending"} ${migration.filename} ${migration.checksum.slice(0, 12)}`);
  }
  if (requireCurrent && pending.length > 0) {
    throw new Error(`Migration frontier 落后 ${pending.length} 个文件`);
  }
}

async function main() {
  const command = process.argv[2] || "status";
  const files = await migrations();
  const db = postgres(databaseUrl(), {
    max: 1,
    connect_timeout: 8,
    idle_timeout: 2,
    onnotice: () => undefined,
  });
  try {
    if (command === "migrate") return await migrate(db, files);
    if (command === "status") return await reportStatus(db, files);
    if (command === "verify") return await reportStatus(db, files, true);
    throw new Error(`未知数据库命令：${command}`);
  } finally {
    await db.end({ timeout: 2 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture database: ${error.message}` : error);
  process.exitCode = 1;
});
