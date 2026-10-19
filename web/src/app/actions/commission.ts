"use server";

import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasLocale, localePath } from "@/i18n/config";
import { syncPublicPhotos } from "@/lib/photos";
import { visitorKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Sellers can only REPORT here (acceptance, transaction, payment, dispute).
// The database functions check ownership and status; verifying payments,
// adjusting and waiving are admin-only.

export type CommissionFormState = { ok?: boolean; error?: string };

const KNOWN_ERRORS = [
  "agreement_required",
  "transaction_details_required",
  "confirmation_required",
  "invalid_date",
  "transaction_value_required",
  "too_many_open_payments",
  "invalid_status_transition",
  "reason_required",
  "commission_disabled",
  "no_active_rule",
  "no_current_agreement",
  "contact_required",
  "images_required",
];

function errorKey(error: { message?: string } | null): string {
  const m = error?.message ?? "";
  return KNOWN_ERRORS.find((k) => m.includes(k)) ?? "generic";
}

const idSchema = z.coerce.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amountSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .pipe(z.string().regex(/^\d{1,10}(\.\d{1,3})?$/))
  .refine((s) => Number(s) > 0);

export async function acceptAndSubmitAction(listingId: unknown, accepted: unknown): Promise<{ ok: true; published: boolean } | { ok: false; error: string }> {
  const id = idSchema.safeParse(listingId);
  if (!id.success) return { ok: false, error: "generic" };
  if (accepted !== true) return { ok: false, error: "mustAccept" };

  const supabase = await createClient();
  const h = await headers();
  // Evidence of acceptance: anonymous IP fingerprint and browser name (no raw IP).
  const evidence = { ip_hash: await visitorKey(), user_agent: (h.get("user-agent") ?? "").slice(0, 200) };

  const accept = await supabase.rpc("accept_agreement", { p_listing_id: id.data, p_evidence: evidence });
  if (accept.error) return { ok: false, error: errorKey(accept.error) };

  const submit = await supabase.rpc("change_listing_status", { p_listing_id: id.data, p_new_status: "pending_approval" });
  if (submit.error) return { ok: false, error: errorKey(submit.error) };

  await syncPublicPhotos(id.data);
  updateTag("listings");
  updateTag(`listing-${id.data}`);
  return { ok: true, published: submit.data === "published" };
}

export async function reportTransactionAction(listingId: number, _prev: CommissionFormState, formData: FormData): Promise<CommissionFormState> {
  const lang = String(formData.get("lang") ?? "");
  const id = idSchema.safeParse(listingId);
  const date = dateSchema.safeParse(formData.get("completedOn"));
  const rawValue = String(formData.get("transactionValue") ?? "").trim();
  const value = rawValue ? amountSchema.safeParse(rawValue) : null;
  if (!id.success || !date.success) return { error: "invalid_date" };
  if (value && !value.success) return { error: "transaction_value_required" };
  if (formData.get("confirm") !== "on") return { error: "confirmation_required" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_transaction", {
    p_listing_id: id.data,
    p_completed_on: date.data,
    // Sent as text so the exact decimal reaches the database.
    p_transaction_value: (value?.success ? value.data : null) as unknown as number,
    p_confirm: true,
  });
  if (error) return { error: errorKey(error) };

  await syncPublicPhotos(id.data); // listing is now sold/rented → photos leave the public bucket
  updateTag("listings");
  updateTag(`listing-${id.data}`);
  redirect(localePath(hasLocale(lang) ? lang : "ar", `/my/commissions/${data}`));
}

export async function reportPaymentAction(commissionId: number, _prev: CommissionFormState, formData: FormData): Promise<CommissionFormState> {
  const parsed = z
    .object({
      id: idSchema,
      method: z.enum(["cliq", "bank_transfer", "other"]),
      amount: amountSchema,
      paidOn: dateSchema,
      reference: z.string().trim().max(100),
    })
    .safeParse({
      id: commissionId,
      method: formData.get("method"),
      amount: formData.get("amount"),
      paidOn: formData.get("paidOn"),
      reference: formData.get("reference") ?? "",
    });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_payment", {
    p_commission_id: parsed.data.id,
    p_method: parsed.data.method,
    p_amount: parsed.data.amount as unknown as number,
    p_paid_on: parsed.data.paidOn,
    p_reference: parsed.data.reference,
  });
  if (error) return { error: errorKey(error) };
  return { ok: true };
}

export async function openDisputeAction(commissionId: number, _prev: CommissionFormState, formData: FormData): Promise<CommissionFormState> {
  const id = idSchema.safeParse(commissionId);
  const reason = z.string().trim().min(10).max(2000).safeParse(formData.get("reason"));
  if (!id.success) return { error: "generic" };
  if (!reason.success) return { error: "reason_required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_commission_dispute", { p_commission_id: id.data, p_reason: reason.data });
  if (error) return { error: errorKey(error) };
  return { ok: true };
}
