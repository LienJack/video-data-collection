import { apiError, apiSuccess, requestId } from "@/src/server/api";
import { database } from "@/src/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId(request);
  try {
    const db = database();
    const [health] = await db<{ database: boolean; migrationCount: number }[]>`
      select
        true as database,
        (select count(*)::integer from egocapture.schema_migrations) as "migrationCount"
    `;
    return apiSuccess({ status: "ok", database: health.database, migrationCount: health.migrationCount }, id);
  } catch {
    return apiError("DEPENDENCY_UNAVAILABLE", "服务依赖暂不可用", id, 503);
  }
}
