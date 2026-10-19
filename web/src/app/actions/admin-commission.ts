"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { getAdminActor } from "@/lib/admin";

// Admin-only commission actions. The server checks admin rights first; the
// database functions check them again and write the audit trail.

export type AdminCommissionResult = { ok: true } | { ok: false; error: string };

const KNOWN = [
  "not_allowed",
  "reason_required",
  "invalid_status_transition",
  "invalid_amount",
  "invalid_date",
  "reference_required",
  "legal_review_note_required",
  "no_current_agreement",
];
function errorOf(error: { message?: string; code?: string } | null): AdminCommissionResult {
  const m = error?.message ?? "";
  if (error?.code === "23505") return { ok: false, error: "duplicate" };
  return { ok: false, error: KNOWN.find((k) => m.includes(k)) ?? "generic" };
}

const idSchema = z.number().int().positive();
const amount = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .pipe(z.string().regex(/^\d{1,10}(\.\d{1,3})?$/));
const note = z.string().trim().max(2000);

export async function adminCommissionAction(commissionId: unknown, action: unknown, newAmount?: unknown, reason?: unknown): Promise<AdminCommissionResult> {
  const id = idSchema.safeParse(commissionId);
  const act = z.enum(["confirm", "adjust", "waive", "resolve_dispute"]).safeParse(action);
  const n = note.safeParse(reason ?? "");
  if (!id.success || !act.success || !n.success) return { ok: false, error: "invalid" };
  let amt: string | null = null;
  if (act.data === "adjust") {
    const parsed = amount.safeParse(newAmount);
    if (!parsed.success) return { ok: false, error: "invalid_amount" };
    amt = parsed.data;
  }

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "not_allowed" };
  const { error } = await actor.supabase.rpc("admin_commission_action", {
    p_commission_id: id.data,
    p_action: act.data,
    p_amount: amt as unknown as number,
    p_note: n.data || undefined,
  });
  return error ? errorOf(error) : { ok: true };
}

export async function adminReviewPaymentAction(input: unknown): Promise<AdminCommissionResult> {
  const parsed = z
    .discriminatedUnion("decision", [
      z.object({
        decision: z.literal("verify"),
        paymentId: idSchema,
        verifiedAmount: amount,
        verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        bankReference: z.string().trim().min(1).max(100),
      }),
      z.object({ decision: z.literal("reject"), paymentId: idSchema, reason: z.string().trim().min(1).max(1000) }),
    ])
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "not_allowed" };
  const p = parsed.data;
  const { error } = await actor.supabase.rpc("admin_review_payment", {
    p_payment_id: p.paymentId,
    p_decision: p.decision,
    p_verified_amount: (p.decision === "verify" ? p.verifiedAmount : null) as unknown as number,
    p_verified_on: p.decision === "verify" ? p.verifiedOn : undefined,
    p_bank_reference: p.decision === "verify" ? p.bankReference : undefined,
    p_reason: p.decision === "reject" ? p.reason : undefined,
  });
  return error ? errorOf(error) : { ok: true };
}

const agreementSchema = z.object({
  versionLabel: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/),
  titleAr: z.string().trim().min(3).max(200),
  titleEn: z.string().trim().min(3).max(200),
  bodyAr: z.string().trim().min(20).max(20000),
  bodyEn: z.string().trim().min(20).max(20000),
  isDraft: z.boolean(),
  legalReviewNote: z.string().trim().max(500),
});

export async function publishAgreementAction(input: unknown): Promise<AdminCommissionResult> {
  const p = agreementSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (!p.data.isDraft && !p.data.legalReviewNote) return { ok: false, error: "legal_review_note_required" };

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "not_allowed" };
  const { error } = await actor.supabase.rpc("admin_publish_agreement", {
    p_version_label: p.data.versionLabel,
    p_title_ar: p.data.titleAr,
    p_title_en: p.data.titleEn,
    p_body_ar: p.data.bodyAr,
    p_body_en: p.data.bodyEn,
    p_is_draft: p.data.isDraft,
    p_legal_review_note: p.data.legalReviewNote, // empty means "none" (the database turns it into NULL)
  });
  if (error) return errorOf(error);
  updateTag("commission-terms");
  return { ok: true };
}

const ruleSchema = z
  .object({
    dealType: z.enum(["sale", "rent"]),
    basis: z.enum(["sale_price", "annual_rent", "monthly_rent", "fixed_amount"]),
    percentage: z.string().trim(),
    fixedAmount: z.string().trim(),
    minAmount: z.string().trim(),
    maxAmount: z.string().trim(),
    dueDays: z.coerce.number().int().min(0).max(365),
    triggerEvent: z.enum(["transaction_completed", "contract_signed"]),
  })
  .superRefine((v, ctx) => {
    const isAmount = (s: string) => /^\d{1,10}(\.\d{1,3})?$/.test(s);
    if (v.basis === "fixed_amount") {
      if (!isAmount(v.fixedAmount) || Number(v.fixedAmount) <= 0) ctx.addIssue({ code: "custom", path: ["fixedAmount"], message: "invalid" });
    } else if (!/^\d{1,3}(\.\d{1,3})?$/.test(v.percentage) || Number(v.percentage) <= 0 || Number(v.percentage) > 100) {
      ctx.addIssue({ code: "custom", path: ["percentage"], message: "invalid" });
    }
    for (const key of ["minAmount", "maxAmount"] as const) {
      if (v[key] && !isAmount(v[key])) ctx.addIssue({ code: "custom", path: [key], message: "invalid" });
    }
    if (v.minAmount && v.maxAmount && Number(v.minAmount) > Number(v.maxAmount)) {
      ctx.addIssue({ code: "custom", path: ["maxAmount"], message: "invalid" });
    }
  });

export async function createRuleAction(input: unknown): Promise<AdminCommissionResult> {
  const p = ruleSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "not_allowed" };
  const v = p.data;
  const asNum = (s: string) => (s ? (s as unknown as number) : (null as unknown as number));
  const { error } = await actor.supabase.rpc("admin_create_commission_rule", {
    p_deal_type: v.dealType,
    p_basis: v.basis,
    p_percentage: v.basis === "fixed_amount" ? (null as unknown as number) : asNum(v.percentage),
    p_fixed_amount: v.basis === "fixed_amount" ? asNum(v.fixedAmount) : (null as unknown as number),
    p_min_amount: asNum(v.minAmount),
    p_max_amount: asNum(v.maxAmount),
    p_due_days: v.dueDays,
    p_trigger_event: v.triggerEvent,
  });
  if (error) return errorOf(error);
  updateTag("commission-terms");
  return { ok: true };
}

export async function retireRuleAction(ruleId: unknown): Promise<AdminCommissionResult> {
  const id = idSchema.safeParse(ruleId);
  if (!id.success) return { ok: false, error: "invalid" };
  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "not_allowed" };
  const { error } = await actor.supabase.rpc("admin_retire_commission_rule", { p_rule_id: id.data });
  if (error) return errorOf(error);
  updateTag("commission-terms");
  return { ok: true };
}
