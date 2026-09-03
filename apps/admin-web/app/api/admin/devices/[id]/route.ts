import { z } from "zod";
import { DomainError } from "@egocapture/core/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireApiAdmin } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { updateDevice, updateDeviceSchema } from "@egocapture/core/server/services/participants";

const idSchema = z.string().regex(/^DEV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
type IdContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdContext) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const { id } = await context.params;
    const result = await updateDevice(viewer, idSchema.parse(id), updateDeviceSchema.parse(await request.json()), requestId);
    return apiSuccess(result, requestId);
  });
}
