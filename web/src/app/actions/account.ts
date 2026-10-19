"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasLocale, localePath } from "@/i18n/config";
import { syncSellerPhotos } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { normalizeJordanPhone } from "@/lib/validation/listing";

export type AccountFormState = { error?: string; fieldErrors?: Record<string, string>; success?: boolean };

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "nameInvalid").max(60, "nameInvalid"),
  phone: z.string().trim().max(20),
  preferredLanguage: z.enum(["ar", "en"]),
});

export async function updateProfileAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    phone: formData.get("phone") ?? "",
    preferredLanguage: formData.get("preferredLanguage"),
  });
  if (!parsed.success) return { fieldErrors: { displayName: "nameInvalid" } };

  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizeJordanPhone(parsed.data.phone);
    if (!phone) return { fieldErrors: { phone: "invalidPhone" } };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "sessionMissing" };

  // Only these three columns are writable by users (enforced in the database).
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, phone, preferred_language: parsed.data.preferredLanguage })
    .eq("id", userId);
  if (error) return { error: "generic" };

  updateTag("listings"); // seller name appears on listing pages
  return { success: true };
}

export async function requestDeletionAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "");
  const locale = hasLocale(lang) ? lang : "ar";
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect(localePath(locale, "/login"));
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) throw new Error("Account deletion request failed");
  // The database withdrew the listings; take their photos off the public bucket.
  await syncSellerPhotos(userId);
  updateTag("listings");
  await supabase.auth.signOut();
  redirect(`${localePath(locale, "/login")}?deleted=1`);
}
