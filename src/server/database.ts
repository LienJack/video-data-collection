import "server-only";

import postgres from "postgres";
import { serverEnvironment } from "@/src/server/env";

type DatabaseGlobal = typeof globalThis & {
  egocaptureDatabase?: postgres.Sql;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export function database(): postgres.Sql {
  databaseGlobal.egocaptureDatabase ??= postgres(serverEnvironment().DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 5 : 2,
    idle_timeout: 20,
    connect_timeout: 8,
    prepare: false,
    transform: postgres.camel,
  });
  return databaseGlobal.egocaptureDatabase;
}
