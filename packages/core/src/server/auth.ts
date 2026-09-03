import "server-only";

import { cache } from "react";
import { database } from "@egocapture/core/server/database";
import { createSupabaseServerClient } from "@egocapture/core/server/supabase/server";

export type Viewer = {
  profileId: string;
  authUserId: string;
  role: "admin" | "participant";
  displayName: string;
  isDemoAdmin: boolean;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const db = database();
  const [profile] = await db<Viewer[]>`
    select
      id as "profileId",
      auth_user_id as "authUserId",
      role,
      display_name as "displayName",
      is_demo_admin as "isDemoAdmin"
    from egocapture.profiles
    where auth_user_id = ${data.user.id}::uuid
    limit 1
  `;
  return profile ?? null;
});
