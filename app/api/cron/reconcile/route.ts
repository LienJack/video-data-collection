import { apiError, apiSuccess } from "@/src/server/api";
import { serverEnvironment } from "@/src/server/env";
import { routeHandler } from "@/src/server/route-handler";
import { runDailyReconciliation } from "@/src/server/services/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    if (request.headers.get("authorization") !== `Bearer ${serverEnvironment().CRON_SECRET}`) {
      return apiError("CRON_UNAUTHORIZED", "Cron 凭据无效", requestId, 401);
    }
    return apiSuccess(await runDailyReconciliation(), requestId);
  });
}
