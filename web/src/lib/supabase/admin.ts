import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv, publicEnv } from "@/lib/env";

// Trusted server-only client using the SECRET key. It bypasses RLS, so only use
// it after the calling code has checked who the user is and what they may do.
export function createAdminClient() {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
