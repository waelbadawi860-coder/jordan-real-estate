"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeJordanPhone } from "@/lib/validation/listing";

// The owner's own office. The database decides what an owner may change
// (name, phone, governorate, about); packages and the badge are admin-only.

export type OfficeFormState = { success?: boolean; error?: string; fieldErrors?: Record<string, string> };

const officeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20),
  cityId: z.string().regex(/^\d*$/),
  about: z.string().trim().max(1000),
});

export async function saveOfficeAction(_prev: OfficeFormState, formData: FormData): Promise<OfficeFormState> {
  const parsed = officeSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    cityId: formData.get("cityId") ?? "",
    about: formData.get("about") ?? "",
  });
  if (!parsed.success) return { fieldErrors: { name: "nameInvalid" } };
  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizeJordanPhone(parsed.data.phone);
    if (!phone) return { fieldErrors: { phone: "invalidPhone" } };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "sessionMissing" };

  const values = {
    name: parsed.data.name,
    phone,
    city_id: parsed.data.cityId ? Number(parsed.data.cityId) : null,
    about: parsed.data.about || null,
  };
  const { data: existing } = await supabase.from("offices").select("id").eq("owner_id", userId).maybeSingle();
  const { error } = existing
    ? await supabase.from("offices").update(values).eq("id", existing.id)
    : await supabase.from("offices").insert({ owner_id: userId, ...values });
  if (error) return { error: "generic" };

  updateTag("offices");
  return { success: true };
}

const verificationSchema = z.object({
  commercialRegNo: z.string().trim().max(50),
  licenseNo: z.string().trim().max(50),
  documents: z.array(z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/)).min(3).max(6),
});

/** Called after the browser has uploaded the documents to private storage. */
export async function submitVerificationAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = verificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_office_verification", {
    p_commercial_reg_no: parsed.data.commercialRegNo,
    p_license_no: parsed.data.licenseNo,
    p_documents: parsed.data.documents,
  });
  if (error) {
    const m = error.message;
    return { ok: false, error: m.includes("already_pending") ? "alreadyPending" : m.includes("office_required") ? "officeRequired" : "generic" };
  }
  return { ok: true };
}
