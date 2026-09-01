import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireApiViewer } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { extractUploadMetadata } from "@/src/server/services/metadata";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiViewer();
    const { id } = await context.params;
    return apiSuccess(await extractUploadMetadata(viewer, id, requestId), requestId);
  });
}
