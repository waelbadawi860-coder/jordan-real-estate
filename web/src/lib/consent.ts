import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localePath, type Locale } from "@/i18n/config";
import { visitorKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type PendingConsent = { document: "terms" | "privacy"; version: string };

/** Evidence kept with an agreement: anonymous IP fingerprint and browser name; no raw IP. */
export async function requestEvidence() {
  const h = await headers();
  return { ip_hash: await visitorKey(), user_agent: (h.get("user-agent") ?? "").slice(0, 200) };
}

/**
 * Documents (terms, privacy policy) whose current version the signed-in user
 * has not accepted yet. Raising a version in the settings asks everyone again.
 */
export async function getPendingConsents(): Promise<PendingConsent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pending_consents");
  if (error) throw new Error("Reading pending consents failed");
  return (data ?? []).filter((d): d is PendingConsent => d.document === "terms" || d.document === "privacy");
}

/** Sends the user to accept the updated terms first (then back to returnTo). */
export async function requireCurrentConsent(locale: Locale, returnTo: string) {
  if ((await getPendingConsents()).length > 0) {
    redirect(`${localePath(locale, "/accept-terms")}?next=${encodeURIComponent(localePath(locale, returnTo))}`);
  }
}
