import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** True when an administrator has blocked this phone (+962…) or e-mail. The database enforces the same rule. */
export async function isBlocked(kind: "phone" | "email", value: string): Promise<boolean> {
  const normalized = kind === "email" ? value.trim().toLowerCase() : value;
  const { data } = await createAdminClient()
    .from("blocked_identifiers")
    .select("id")
    .eq("kind", kind)
    .eq("value", normalized)
    .maybeSingle();
  return Boolean(data);
}
