import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allLifecycleEdges, lifecycleMachines } from "@egocapture/core/domain/lifecycle-machines";

const guardMigration = readFileSync(
  join(process.cwd(), "database/migrations/0019_lifecycle_state_machine_guards.sql"),
  "utf8",
);
const migrationSnapshot = readdirSync(join(process.cwd(), "database/migrations"))
  .filter((filename) => /^\d{4}_[a-z0-9_]+\.sql$/.test(filename))
  .sort()
  .map((filename) => readFileSync(join(process.cwd(), "database/migrations", filename), "utf8"))
  .join("\n");

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
});
