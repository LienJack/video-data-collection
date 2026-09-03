import { DomainError } from "@egocapture/core/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireApiViewer } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { extractUploadMetadata } from "@egocapture/core/server/services/metadata";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiViewer();
    const { id } = await context.params;
    const reason = viewer.role === "admin"
      ? z.object({ reason: z.string().trim().min(10).max(500) }).parse(await request.json()).reason
      : undefined;
    return apiSuccess(await extractUploadMetadata(viewer, id, requestId, reason), requestId);
  });
}
import { z } from "zod";
