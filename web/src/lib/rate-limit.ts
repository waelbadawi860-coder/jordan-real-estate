import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Anonymous, non-reversible key for the visitor's IP address (raw IPs are never stored). */
export async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  return createHmac("sha256", getServerEnv().SUPABASE_SECRET_KEY).update(ip).digest("base64url").slice(0, 32);
}

/**
 * Counts one attempt for this visitor and returns false once `max` attempts
 * were made within the window. Enforced in the database, so it holds across
 * all server instances.
 */
export async function withinVisitorLimit(action: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: `${action}:${await visitorKey()}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return Boolean(data);
}
