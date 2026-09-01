import "server-only";

import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "@/src/server/env";

export function createSupabaseAdminClient() {
  const environment = serverEnvironment();
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
