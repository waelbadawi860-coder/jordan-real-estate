import "server-only";
import { headers } from "next/headers";
import { visitorKey } from "@/lib/rate-limit";
import type { createClient } from "@/lib/supabase/server";

/**
 * Records the seller declaration for a listing (permanent evidence in the
 * database). Call it right before a submission: the database refuses a
 * seller's submission without a fresh declaration.
 */
export async function recordDeclaration(supabase: Awaited<ReturnType<typeof createClient>>, listingId: number) {
  const h = await headers();
  // Anonymous IP fingerprint and browser name; no raw IP is stored.
  const evidence = { ip_hash: await visitorKey(), user_agent: (h.get("user-agent") ?? "").slice(0, 200) };
  return supabase.rpc("declare_listing", { p_listing_id: listingId, p_evidence: evidence });
}
