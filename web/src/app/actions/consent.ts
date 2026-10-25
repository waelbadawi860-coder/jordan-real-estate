"use server";

import { redirect } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth";
import { requestEvidence } from "@/lib/consent";
import { createClient } from "@/lib/supabase/server";

export type ConsentFormState = { error?: "termsRequired" | "generic" };

/** Records agreement to the current terms and privacy policy, then goes back. */
export async function acceptTermsAction(_prev: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  const lang = String(formData.get("lang") ?? "");
  const locale = hasLocale(lang) ? lang : "ar";
  if (formData.get("acceptTerms") !== "on") return { error: "termsRequired" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(localePath(locale, "/login"));

  // The database records the versions that are current right now.
  const { error } = await supabase.rpc("accept_current_terms", { p_evidence: await requestEvidence() });
  if (error) return { error: "generic" };

  redirect(safeNextPath(formData.get("next"), localePath(locale, "/my/listings")));
}
