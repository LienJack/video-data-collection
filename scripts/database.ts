import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";
import {
  allLifecycleEdges,
  lifecycleMachines,
} from "@egocapture/core/domain/lifecycle-machines";

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

async function verifyStateMachineGuards(db: postgres.Sql) {
  const [guard] = await db<{ fixtureRefreshFunction: string | null; hasFixtureBypass: boolean }[]>`
    select
      to_regprocedure('egocapture.refresh_demo_fixture_lifecycles()')::text as "fixtureRefreshFunction",
      position(
        'egocapture.scoped_fixture_refresh'
        in pg_get_functiondef('egocapture.enforce_state_machine_transition()'::regprocedure)
      ) > 0 as "hasFixtureBypass"
  `;
  if (guard.fixtureRefreshFunction || guard.hasFixtureBypass) {
    throw new Error("状态机 Trigger 仍包含 fixture 逆向迁移旁路");
  }
  const registryEdges = await db<{ machine: string; fromState: string; toState: string }[]>`
    select machine, from_state as "fromState", to_state as "toState"
    from egocapture.state_machine_transitions
    order by machine, from_state, to_state
  `;
  const edgeKey = (edge: { machine: string; from: string; to: string }) =>
    `${edge.machine}:${edge.from}:${edge.to}`;
  const expectedEdges = new Set(allLifecycleEdges.map(edgeKey));
  const actualEdges = new Set(registryEdges.map((edge) => edgeKey({
    machine: edge.machine,
    from: edge.fromState,
    to: edge.toState,
  })));
  const missingEdges = [...expectedEdges].filter((edge) => !actualEdges.has(edge));
  const unexpectedEdges = [...actualEdges].filter((edge) => !expectedEdges.has(edge));
  if (missingEdges.length > 0 || unexpectedEdges.length > 0) {
    throw new Error(
      `状态机 registry 与 TypeScript 图不一致；missing=${missingEdges.join(",") || "none"}; unexpected=${unexpectedEdges.join(",") || "none"}`,
    );
  }
  const expectedMachineCount = Object.values(lifecycleMachines)
    .filter((machine) => Object.keys(machine.definition.transitions).length > 0)
    .length;
  const actualMachineCount = new Set(registryEdges.map((edge) => edge.machine)).size;
  if (actualMachineCount !== expectedMachineCount) {
    throw new Error(`状态机 registry 机器数量不一致：${actualMachineCount}/${expectedMachineCount}`);
  }
  const [triggers] = await db<{ triggerCount: number }[]>`
    select count(*)::integer as "triggerCount"
    from pg_trigger trigger
    join pg_proc procedure on procedure.oid = trigger.tgfoid
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'egocapture'
      and procedure.proname = 'enforce_state_machine_transition'
      and not trigger.tgisinternal
  `;
  if (triggers.triggerCount !== 15) {
    throw new Error(`状态机 Trigger 不完整：${triggers.triggerCount}/15`);
  }
  await db.unsafe(`
    do $state_machine_probe$
    declare
      probe_id uuid := gen_random_uuid();
    begin
      insert into egocapture.participants (id, public_id, display_alias, is_fixture)
      values (probe_id, 'PT-STATECHK', 'State guard probe', true);
      begin
        update egocapture.participants set status = 'active' where id = probe_id;
        raise exception 'STATE_MACHINE_GUARD_DID_NOT_REJECT';
      exception
        when check_violation then
          if SQLERRM not like 'INVALID_STATE_TRANSITION:%' then
            raise;
          end if;
      end;
      delete from egocapture.participants where id = probe_id;
    end
    $state_machine_probe$;
  `);
  console.log(`verified lifecycle guards ${actualMachineCount} machines / ${actualEdges.size} edges / ${triggers.triggerCount} triggers`);
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
    if (command === "verify") {
      await reportStatus(db, files, true);
      return await verifyStateMachineGuards(db);
    }
    throw new Error(`未知数据库命令：${command}`);
  } finally {
    await db.end({ timeout: 2 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture database: ${error.message}` : error);
  process.exitCode = 1;
});
