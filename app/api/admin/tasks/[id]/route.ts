import { z } from "zod";
import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireApiAdmin } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { getTask, updateTask, updateTaskSchema } from "@/src/server/services/tasks";

const idSchema = z.string().regex(/^TSK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
type IdContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: IdContext) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const { id } = await context.params;
    return apiSuccess(await getTask(viewer, idSchema.parse(id)), requestId);
  });
}

export async function PATCH(request: Request, context: IdContext) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const { id } = await context.params;
    return apiSuccess(
      await updateTask(viewer, idSchema.parse(id), updateTaskSchema.parse(await request.json()), requestId),
      requestId,
    );
  });
}
