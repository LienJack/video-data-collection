import "server-only";

import { DomainError } from "@egocapture/core/domain/errors";
import { getViewer, type Viewer } from "@egocapture/core/server/auth";

export async function requireApiViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new DomainError("AUTH_REQUIRED", "请先登录", 401);
  return viewer;
}

export async function requireApiAdmin(): Promise<Viewer> {
  const viewer = await requireApiViewer();
  if (viewer.role !== "admin") throw new DomainError("FORBIDDEN", "无权执行该操作", 403);
  return viewer;
}

export async function requireApiParticipant(): Promise<Viewer> {
  const viewer = await requireApiViewer();
  if (viewer.role !== "participant") throw new DomainError("FORBIDDEN", "无权执行该操作", 403);
  return viewer;
}
