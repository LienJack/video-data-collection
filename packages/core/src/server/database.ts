import "server-only";

import postgres from "postgres";
import { serverEnvironment } from "@egocapture/core/server/env";

type DatabaseGlobal = typeof globalThis & {
  egocaptureDatabase?: postgres.Sql;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export function database(): postgres.Sql {
  databaseGlobal.egocaptureDatabase ??= postgres(serverEnvironment().DATABASE_URL, {
    // Every Vercel function instance owns its own postgres.js pool. Keep that pool
    // to one connection so concurrent route bundles cannot exhaust Supavisor.
    max: process.env.NODE_ENV === "production" ? 1 : 2,
    idle_timeout: 20,
    connect_timeout: 8,
    prepare: false,
    transform: postgres.camel,
  });
  return databaseGlobal.egocaptureDatabase;
}
