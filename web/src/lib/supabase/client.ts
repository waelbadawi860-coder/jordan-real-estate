import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Supabase client for code running in the visitor's browser.
// It only ever has the publishable key; RLS policies decide what it can see.
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
