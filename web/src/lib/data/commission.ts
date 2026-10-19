import "server-only";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { CommissionRule } from "@/lib/commission";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AgreementVersion = {
  id: number;
  label: string;
  title: { ar: string; en: string };
  body: { ar: string; en: string };
  isDraft: boolean;
  legalReviewNote: string | null;
  createdAt: string;
};

type RuleRow = Database["public"]["Tables"]["commission_rules"]["Row"];
type VersionRow = Database["public"]["Tables"]["agreement_versions"]["Row"];

export function toRule(r: RuleRow): CommissionRule {
  return {
    id: r.id,
    dealType: r.deal_type,
    basis: r.basis,
    percentage: r.percentage === null ? null : String(r.percentage),
    fixedAmount: r.fixed_amount === null ? null : String(r.fixed_amount),
    minAmount: r.min_amount === null ? null : String(r.min_amount),
    maxAmount: r.max_amount === null ? null : String(r.max_amount),
    dueDays: r.due_days,
    triggerEvent: r.trigger_event === "contract_signed" ? "contract_signed" : "transaction_completed",
    agreementVersionId: r.agreement_version_id,
  };
}

export function toVersion(v: VersionRow): AgreementVersion {
  return {
    id: v.id,
    label: v.version_label,
    title: { ar: v.title_ar, en: v.title_en },
    body: { ar: v.body_ar, en: v.body_en },
    isDraft: v.is_draft,
    legalReviewNote: v.legal_review_note,
    createdAt: v.created_at,
  };
}

/** Current agreement text and active rules (public information, cached briefly). */
export async function getCommissionTerms(): Promise<{ agreement: AgreementVersion | null; rules: CommissionRule[] }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("commission-terms");
  const sb = createPublicClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [versions, rules] = await Promise.all([
    sb.from("agreement_versions").select("*").eq("is_current", true).maybeSingle(),
    sb.from("commission_rules").select("*").eq("is_active", true).order("deal_type"),
  ]);
  if (versions.error || rules.error) throw new Error("Loading commission terms failed");
  return { agreement: versions.data ? toVersion(versions.data) : null, rules: (rules.data ?? []).map(toRule) };
}

/**
 * Whether the commission system is on, read fresh (never cached) so switching
 * it off takes effect immediately for sellers. The database enforces the same
 * setting independently.
 */
export async function isCommissionEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "commission_enabled").maybeSingle();
  return data?.value === true;
}

/** The seller's acceptance of the CURRENT agreement for a listing, if any. */
export async function getCurrentAcceptance(listingId: number, agreementId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accepted_agreements")
    .select("id, accepted_at")
    .eq("listing_id", listingId)
    .eq("agreement_version_id", agreementId)
    .maybeSingle();
  return data;
}

/** The rule a listing was accepted under (the one that will apply). */
export async function getAcceptedRule(listingId: number): Promise<CommissionRule | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accepted_agreements")
    .select("rule_id, commission_rules(*)")
    .eq("listing_id", listingId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rule = data?.commission_rules as RuleRow | null | undefined;
  return rule ? toRule(rule) : null;
}

export type CommissionStatus = Database["public"]["Enums"]["commission_status"];

export type CommissionSummary = {
  id: number;
  reference: string;
  listingId: number;
  listingTitle: string;
  dealType: "sale" | "rent";
  status: CommissionStatus;
  amountDue: number;
  amountVerified: number;
  dueDate: string;
  createdAt: string;
};

export async function getMyCommissions(userId: string): Promise<CommissionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_records")
    .select("id, reference, listing_id, deal_type, status, amount_due, amount_verified, due_date, created_at, listings(title)")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Loading commissions failed: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    reference: c.reference,
    listingId: c.listing_id,
    listingTitle: (c.listings as { title: string } | null)?.title ?? "",
    dealType: c.deal_type,
    status: c.status,
    amountDue: Number(c.amount_due),
    amountVerified: Number(c.amount_verified),
    dueDate: c.due_date,
    createdAt: c.created_at,
  }));
}

/** Full commission with payments and history; RLS limits it to the seller (or admins). */
export async function getCommissionDetail(id: number) {
  const supabase = await createClient();
  const [{ data: commission }, { data: payments }, { data: events }] = await Promise.all([
    supabase
      .from("commission_records")
      .select("*, listings(title), commission_rules(*), accepted_agreements(accepted_at, agreement_version_id, agreement_versions(version_label, is_draft))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("payment_records").select("*").eq("commission_id", id).order("created_at"),
    supabase.from("commission_events").select("id, event, from_status, to_status, amount, note, created_at").eq("commission_id", id).order("id"),
  ]);
  if (!commission) return null;
  return { commission, payments: payments ?? [], events: events ?? [] };
}

export async function hasAnyCommission(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase.from("commission_records").select("id", { count: "exact", head: true }).eq("seller_id", userId);
  return (count ?? 0) > 0;
}
