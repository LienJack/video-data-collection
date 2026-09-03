import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allLifecycleEdges, lifecycleMachines } from "@egocapture/core/domain/lifecycle-machines";

const guardMigration = readFileSync(
  join(process.cwd(), "database/migrations/0019_lifecycle_state_machine_guards.sql"),
  "utf8",
);
const migrationsDirectory = join(process.cwd(), "database/migrations");
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((filename) => /^\d{4}_[a-z0-9_]+\.sql$/.test(filename))
  .sort();
const migrationSnapshot = migrationFiles
  .map((filename) => readFileSync(join(migrationsDirectory, filename), "utf8"))
  .join("\n");
const registryRlsMigrationFilename = "0024_enable_state_machine_registry_rls.sql";
const registryRlsMigration = readFileSync(
  join(migrationsDirectory, registryRlsMigrationFilename),
  "utf8",
);

function sqlEdges() {
  return [...migrationSnapshot.matchAll(/\('([^']+)', '([^']+)', '([^']+)'\)/g)]
    .map((match) => ({ machine: match[1], from: match[2], to: match[3] }))
    .filter((edge) => edge.machine in lifecycleMachines);
}

describe("database lifecycle contract", () => {
  it("has exactly the same unique edges as the XState definitions", () => {
    const normalize = (edge: { machine: string; from: string; to: string }) =>
      `${edge.machine}:${edge.from}:${edge.to}`;
    expect(new Set(sqlEdges().map(normalize))).toEqual(new Set(allLifecycleEdges.map(normalize)));
  });

  it("installs one guarded column for every persistent machine", () => {
    for (const machine of Object.keys(lifecycleMachines)) {
      expect(guardMigration).toContain(`'${machine}'`);
    }
    expect(guardMigration).toContain("INVALID_STATE_TRANSITION");
    expect(guardMigration).toContain("before update of");
  });

  it("enables RLS for every business table created by migrations", () => {
    const createdTables = new Set(
      [...migrationSnapshot.matchAll(/create table(?: if not exists)?\s+egocapture\.([a-z0-9_]+)/gi)]
        .map((match) => match[1])
        .filter((table) => table !== "schema_migrations"),
    );
    const rlsTables = new Set(
      [...migrationSnapshot.matchAll(/alter table\s+egocapture\.([a-z0-9_]+)\s+enable row level security/gi)]
        .map((match) => match[1]),
    );

    expect(rlsTables).toEqual(createdTables);
  });

  it("hardens the state-machine registry with an additive migration", () => {
    const predecessorIndex = migrationFiles.indexOf("0023_remove_fixture_state_guard_bypass.sql");
    const registryRlsMigrationIndex = migrationFiles.indexOf(registryRlsMigrationFilename);

    expect(predecessorIndex).toBeGreaterThanOrEqual(0);
    expect(registryRlsMigrationIndex).toBeGreaterThan(predecessorIndex);
    expect(registryRlsMigration).toContain(
      "alter table egocapture.state_machine_transitions enable row level security",
    );
    expect(registryRlsMigration).not.toMatch(/force row level security/i);
    expect(registryRlsMigration).not.toMatch(/\b(?:create|alter)\s+policy\b/i);
    expect(registryRlsMigration).not.toMatch(/\bgrant\b/i);
  });
});
