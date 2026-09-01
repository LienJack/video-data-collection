import "server-only";

import { ZodError } from "zod";
import { DomainError } from "@/src/domain/errors";
import { apiError, requestId } from "@/src/server/api";

export async function routeHandler(
  request: Request,
  handler: (id: string) => Promise<Response>,
): Promise<Response> {
  const id = requestId(request);
  try {
    return await handler(id);
  } catch (error) {
    if (error instanceof DomainError) return apiError(error.code, error.message, id, error.status);
    if (error instanceof ZodError) return apiError("VALIDATION_FAILED", "输入信息不完整或格式不正确", id, 422, error);
    console.error("EgoCapture request failed", { requestId: id, code: "INTERNAL_ERROR" });
    return apiError("INTERNAL_ERROR", "服务暂时无法处理请求", id, 500);
  }
}
