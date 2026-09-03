import { z } from "zod";
import { DomainError } from "@egocapture/core/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireIdempotencyKey } from "@egocapture/core/server/idempotency";
import { requireApiParticipant } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { getMarker, regenerateMarker } from "@egocapture/core/server/services/sessions";

const idSchema = z.string().regex(/^RS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
type IdContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: IdContext) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiParticipant();
    const { id } = await context.params;
    return apiSuccess(await getMarker(viewer, idSchema.parse(id)), requestId);
  });
}

export async function POST(request: Request, context: IdContext) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiParticipant();
    const { id } = await context.params;
    return apiSuccess(
      await regenerateMarker(viewer, idSchema.parse(id), requireIdempotencyKey(request), requestId),
      requestId,
      201,
    );
  });
}
