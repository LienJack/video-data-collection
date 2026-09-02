import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnvironment } from "@egocapture/core/server/env";

export async function createSupabaseServerClient() {
  const environment = serverEnvironment();
  const cookieStore = await cookies();
  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const cookie of cookiesToSet) cookieStore.set(cookie.name, cookie.value, cookie.options);
          } catch {
            // Server Components cannot write cookies; proxy.ts refreshes them.
          }
        },
      },
    },
  );
}
