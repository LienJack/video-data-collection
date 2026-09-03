import "server-only";

import { getViewer, type Viewer } from "@egocapture/core/server/auth";
import { redirect } from "next/navigation";

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "admin") redirect("/login?reason=role");
  return viewer;
}
