/**
 * Commission system tests (DEVELOPMENT database only).
 * Temporarily switches commissions ON, creates test rules, users and listings,
 * and restores everything at the end.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, noSession);
const runId = randomUUID().slice(0, 8);

type U = { id: string; client: SupabaseClient };
async function createUser(name: string, role: "user" | "admin" = "user"): Promise<U> {
  const email = `test-${runId}-${name}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (role === "admin") await service.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const client = createClient(url, publishableKey, noSession);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

let seller: U;
let other: U;
let admin: U;
let refIds: { city: number; type: number };
let originalVersionId: number;
let originalEnabled: unknown;
const ruleIds: number[] = [];
const versionIds: number[] = [];

async function newListing(user: U, title: string, deal: "sale" | "rent") {
  const { data, error } = await user.client
    .from("listings")
    .insert({ title, deal_type: deal, property_type_id: refIds.type, city_id: refIds.city, price: 1000, details: deal === "rent" ? { rent_period: "monthly" } : {} })
    .select("id")
    .single();
  if (error) throw error;
  await user.client.from("listing_contacts").insert({ listing_id: data.id, phone: "+962791234567" });
  await user.client.from("listing_images").insert({ listing_id: data.id, storage_path: `${user.id}/${data.id}/${randomUUID()}.webp` });
  return data.id as number;
}

async function publish(listingId: number) {
  const { error } = await admin.client.rpc("change_listing_status", { p_listing_id: listingId, p_new_status: "published" });
  if (error) throw error;
}

beforeAll(async () => {
  [seller, other, admin] = await Promise.all([createUser("cseller"), createUser("cother"), createUser("cadmin", "admin")]);
  const [city, type, version, enabled] = await Promise.all([
    service.from("cities").select("id").eq("slug", "amman").single(),
    service.from("property_types").select("id").eq("slug", "apartment").single(),
    service.from("agreement_versions").select("id").eq("is_current", true).single(),
    service.from("site_settings").select("value").eq("key", "commission_enabled").single(),
  ]);
  refIds = { city: city.data!.id, type: type.data!.id };
  originalVersionId = version.data!.id;
  originalEnabled = enabled.data!.value;

  // Test rules: sale 2% (min 100, max 5000, due in 7 days); rent 50% of monthly rent, due immediately.
  const sale = await admin.client.rpc("admin_create_commission_rule", {
    p_deal_type: "sale", p_basis: "sale_price", p_percentage: 2, p_fixed_amount: null, p_min_amount: 100, p_max_amount: 5000, p_due_days: 7, p_trigger_event: "transaction_completed",
  });
  const rent = await admin.client.rpc("admin_create_commission_rule", {
    p_deal_type: "rent", p_basis: "monthly_rent", p_percentage: 50, p_fixed_amount: null, p_min_amount: null, p_max_amount: null, p_due_days: 0, p_trigger_event: "transaction_completed",
  });
  if (sale.error || rent.error) throw sale.error ?? rent.error;
  ruleIds.push(sale.data as number, rent.data as number);
  await service.from("site_settings").update({ value: true }).eq("key", "commission_enabled");
}, 60_000);

afterAll(async () => {
  await service.from("site_settings").update({ value: originalEnabled }).eq("key", "commission_enabled");
  const users = [seller, other, admin].filter(Boolean).map((u) => u.id);
  const { data: commissions } = await service.from("commission_records").select("id").in("seller_id", users);
  const cids = (commissions ?? []).map((c) => c.id);
  if (cids.length) {
    await service.from("commission_events").delete().in("commission_id", cids);
    await service.from("payment_records").delete().in("commission_id", cids);
    await service.from("commission_records").delete().in("id", cids);
  }
  await service.from("accepted_agreements").delete().in("user_id", users);
  await service.from("listings").delete().in("seller_id", users);
  await service.from("commission_rules").delete().in("id", ruleIds);
  await service.from("agreement_versions").update({ is_current: false }).eq("is_current", true);
  await service.from("agreement_versions").update({ is_current: true }).eq("id", originalVersionId);
  if (versionIds.length) await service.from("agreement_versions").delete().in("id", versionIds);
  // Notifications reference users and are removed with them.
  for (const id of users) await service.auth.admin.deleteUser(id);
});

describe("commission amounts (exact decimals)", () => {
  it("applies percentage, minimum and maximum", async () => {
    const calc = (value: number | null, basis = "sale_price", pct = 2, fixed: number | null = null) =>
      service.rpc("commission_amount", { p_basis: basis, p_percentage: pct, p_fixed: fixed, p_min: 100, p_max: 5000, p_value: value });
    expect((await calc(200000)).data).toBe(4000);
    expect((await calc(1000)).data).toBe(100); // minimum
    expect((await calc(1000000)).data).toBe(5000); // maximum
    expect((await calc(12345.678, "sale_price", 2.5)).data).toBe(308.642); // rounded to fils
    expect((await calc(null, "fixed_amount", 0, 250)).data).toBe(250);
    expect((await calc(null)).error?.message).toContain("transaction_value_required");
  });
});

describe("browser estimate matches the database exactly", () => {
  it("for 200 random amounts and percentages", async () => {
    const { estimateCommission } = await import("@/lib/commission");
    // Fixed seed so a failure can be reproduced.
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const cases = Array.from({ length: 200 }, () => {
      const value = (Math.floor(rand() * 5_000_000_000) / 1000).toFixed(3);
      const pct = (Math.floor(rand() * 10_000) / 1000 + 0.001).toFixed(3);
      return { value, pct };
    });
    const results = await Promise.all(
      cases.map((c) =>
        service.rpc("commission_amount", {
          p_basis: "sale_price",
          p_percentage: c.pct as unknown as number,
          p_fixed: null,
          p_min: null,
          p_max: null,
          p_value: c.value as unknown as number,
        }),
      ),
    );
    const mismatches = cases.filter((c, i) => {
      const js = estimateCommission(
        { id: 0, dealType: "sale", basis: "sale_price", percentage: c.pct, fixedAmount: null, minAmount: null, maxAmount: null, dueDays: 0, triggerEvent: "transaction_completed", agreementVersionId: 0 },
        c.value,
      );
      return Number(js) !== Number(results[i].data);
    });
    expect(mismatches).toEqual([]);
  });
});

describe("agreement acceptance", () => {
  let listingId: number;
  beforeAll(async () => {
    listingId = await newListing(seller, "Commission sale flat", "sale");
  });

  it("is required before submitting while commissions are on", async () => {
    const res = await seller.client.rpc("change_listing_status", { p_listing_id: listingId, p_new_status: "pending_approval" });
    expect(res.error?.message).toContain("agreement_required");
  });

  it("records the exact version, rule and a fingerprint of the text", async () => {
    const accepted = await seller.client.rpc("accept_agreement", { p_listing_id: listingId, p_evidence: { ip_hash: "test" } });
    expect(accepted.error).toBeNull();
    const { data } = await seller.client.from("accepted_agreements").select("*").eq("listing_id", listingId).single();
    expect(data!.agreement_version_id).toBe(originalVersionId);
    expect(data!.rule_id).toBe(ruleIds[0]);
    expect(data!.agreement_text_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(data!.rule_snapshot.percentage).toBe(2);

    const submit = await seller.client.rpc("change_listing_status", { p_listing_id: listingId, p_new_status: "pending_approval" });
    expect(submit.error).toBeNull();
  });

  it("other users can't see or forge acceptances, and nobody writes them directly", async () => {
    expect((await other.client.from("accepted_agreements").select("id").eq("listing_id", listingId)).data).toHaveLength(0);
    expect((await other.client.rpc("accept_agreement", { p_listing_id: listingId })).error?.message).toContain("listing_not_found");
    const forged = await seller.client.from("accepted_agreements").insert({
      user_id: seller.id, listing_id: listingId, listing_title: "x", agreement_version_id: originalVersionId, agreement_text_sha256: "x", rule_id: ruleIds[0], rule_snapshot: {},
    });
    expect(forged.error).not.toBeNull();
  });

  it("locks the sale/rent type once accepted", async () => {
    const res = await seller.client.from("listings").update({ deal_type: "rent" }).eq("id", listingId);
    expect(res.error?.message).toContain("deal_type_locked");
  });
});

describe("sale → commission → payment", () => {
  let listingId: number;
  let commissionId: number;

  beforeAll(async () => {
    const { data } = await service.from("listings").select("id").eq("seller_id", seller.id).eq("title", "Commission sale flat").single();
    listingId = data!.id;
    await publish(listingId);
  });

  it("can't simply be marked sold: transaction details are required", async () => {
    const res = await seller.client.rpc("change_listing_status", { p_listing_id: listingId, p_new_status: "sold" });
    expect(res.error?.message).toContain("transaction_details_required");
  });

  it("reporting the sale creates the commission and marks the listing sold", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const noConfirm = await seller.client.rpc("report_transaction", { p_listing_id: listingId, p_completed_on: today, p_transaction_value: 200000, p_confirm: false });
    expect(noConfirm.error?.message).toContain("confirmation_required");

    const res = await seller.client.rpc("report_transaction", { p_listing_id: listingId, p_completed_on: today, p_transaction_value: 200000, p_confirm: true });
    expect(res.error).toBeNull();
    commissionId = res.data as number;

    const { data } = await seller.client.from("commission_records").select("*").eq("id", commissionId).single();
    expect(data!.amount_due).toBe(4000);
    expect(data!.status).toBe("reported");
    expect(data!.reference).toMatch(/^CM-\d+-[0-9A-F]{5}$/);
    const listing = await service.from("listings").select("status").eq("id", listingId).single();
    expect(listing.data!.status).toBe("sold");
  });

  it("sellers can't change amounts or statuses, nor act as admin", async () => {
    const edit = await seller.client.from("commission_records").update({ amount_due: 1 }).eq("id", commissionId);
    expect(edit.error).not.toBeNull();
    const fake = await seller.client.rpc("admin_commission_action", { p_commission_id: commissionId, p_action: "waive", p_note: "please" });
    expect(fake.error?.message).toContain("not_allowed");
    expect((await other.client.from("commission_records").select("id").eq("id", commissionId)).data).toHaveLength(0);
  });

  it("admin confirms the transaction (not yet due: 7-day term)", async () => {
    const res = await admin.client.rpc("admin_commission_action", { p_commission_id: commissionId, p_action: "confirm" });
    expect(res.data).toBe("not_yet_due");
  });

  it("a reported payment is only a claim until an admin verifies it", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const pay = await seller.client.rpc("report_payment", { p_commission_id: commissionId, p_method: "cliq", p_amount: 1000, p_paid_on: today, p_reference: "TX1" });
    expect(pay.error).toBeNull();
    let c = await seller.client.from("commission_records").select("status, amount_verified").eq("id", commissionId).single();
    expect(c.data).toEqual({ status: "payment_reported", amount_verified: 0 });

    const sellerVerify = await seller.client.rpc("admin_review_payment", { p_payment_id: pay.data, p_decision: "verify", p_verified_amount: 1000, p_verified_on: today, p_bank_reference: "x" });
    expect(sellerVerify.error?.message).toContain("not_allowed");
    const directVerify = await seller.client.from("payment_records").update({ status: "verified" }).eq("id", pay.data);
    expect(directVerify.error).not.toBeNull();

    const noRef = await admin.client.rpc("admin_review_payment", { p_payment_id: pay.data, p_decision: "verify", p_verified_amount: 1000, p_verified_on: today, p_bank_reference: "" });
    expect(noRef.error?.message).toContain("reference_required");

    const partial = await admin.client.rpc("admin_review_payment", { p_payment_id: pay.data, p_decision: "verify", p_verified_amount: 1000, p_verified_on: today, p_bank_reference: "BANK-1" });
    expect(partial.data).toBe("not_yet_due"); // 1000 of 4000 verified
    c = await seller.client.from("commission_records").select("status, amount_verified").eq("id", commissionId).single();
    expect(c.data!.amount_verified).toBe(1000);

    const rest = await seller.client.rpc("report_payment", { p_commission_id: commissionId, p_method: "bank_transfer", p_amount: 3000, p_paid_on: today, p_reference: "TX2" });
    const full = await admin.client.rpc("admin_review_payment", { p_payment_id: rest.data, p_decision: "verify", p_verified_amount: 3000, p_verified_on: today, p_bank_reference: "BANK-2" });
    expect(full.data).toBe("payment_verified");
  });

  it("keeps a complete event history", async () => {
    const { data } = await seller.client.from("commission_events").select("event").eq("commission_id", commissionId).order("id");
    expect(data!.map((e) => e.event)).toEqual([
      "transaction_reported",
      "admin_confirm",
      "payment_reported",
      "payment_verified",
      "payment_reported",
      "payment_verified",
    ]);
  });
});

describe("rentals, disputes, waivers and rule changes", () => {
  let rentListing: number;
  let commissionId: number;

  beforeAll(async () => {
    rentListing = await newListing(seller, "Commission rent flat", "rent");
    await seller.client.rpc("accept_agreement", { p_listing_id: rentListing });
    await seller.client.rpc("change_listing_status", { p_listing_id: rentListing, p_new_status: "pending_approval" });
    await publish(rentListing);
    const today = new Date().toISOString().slice(0, 10);
    const res = await seller.client.rpc("report_transaction", { p_listing_id: rentListing, p_completed_on: today, p_transaction_value: 600, p_confirm: true });
    if (res.error) throw res.error;
    commissionId = res.data as number;
  });

  it("calculates half a month's rent and is due immediately after confirmation", async () => {
    const { data } = await seller.client.from("commission_records").select("amount_due").eq("id", commissionId).single();
    expect(data!.amount_due).toBe(300);
    const confirm = await admin.client.rpc("admin_commission_action", { p_commission_id: commissionId, p_action: "confirm" });
    expect(confirm.data).toBe("pending");
  });

  it("a later rule change does not alter existing commissions", async () => {
    const newRule = await admin.client.rpc("admin_create_commission_rule", {
      p_deal_type: "rent", p_basis: "annual_rent", p_percentage: 10, p_fixed_amount: null, p_min_amount: null, p_max_amount: null, p_due_days: 30, p_trigger_event: "transaction_completed",
    });
    ruleIds.push(newRule.data as number);
    const { data } = await seller.client.from("commission_records").select("amount_due, rule_id").eq("id", commissionId).single();
    expect(data).toEqual({ amount_due: 300, rule_id: ruleIds[1] });
  });

  it("seller can dispute with a reason; admin resolves with an adjusted amount", async () => {
    const short = await seller.client.rpc("open_commission_dispute", { p_commission_id: commissionId, p_reason: "no" });
    expect(short.error?.message).toContain("reason_required");
    const dispute = await seller.client.rpc("open_commission_dispute", { p_commission_id: commissionId, p_reason: "The tenant left after one week." });
    expect(dispute.error).toBeNull();

    const noReason = await admin.client.rpc("admin_commission_action", { p_commission_id: commissionId, p_action: "adjust", p_amount: 150 });
    expect(noReason.error?.message).toContain("reason_required");
    const adjust = await admin.client.rpc("admin_commission_action", { p_commission_id: commissionId, p_action: "adjust", p_amount: 150, p_note: "Agreed reduction" });
    expect(adjust.data).toBe("pending");
    const { data } = await seller.client.from("commission_records").select("amount_due, calculated_amount").eq("id", commissionId).single();
    expect(data).toEqual({ amount_due: 150, calculated_amount: 300 }); // original calculation kept
  });

  it("waiving requires a reason and is final", async () => {
    expect((await admin.client.rpc("admin_commission_action", { p_commission_id: commissionId, p_action: "waive" })).error?.message).toContain("reason_required");
    expect((await admin.client.rpc("admin_commission_action", { p_commission_id: commissionId, p_action: "waive", p_note: "Goodwill" })).data).toBe("waived");
    const today = new Date().toISOString().slice(0, 10);
    const pay = await seller.client.rpc("report_payment", { p_commission_id: commissionId, p_method: "cliq", p_amount: 10, p_paid_on: today, p_reference: "x" });
    expect(pay.error?.message).toContain("invalid_status_transition");
  });
});

describe("agreement versions", () => {
  it("only admins publish; a new version requires sellers to accept again", async () => {
    const asUser = await seller.client.rpc("admin_publish_agreement", {
      p_version_label: `t-${runId}`, p_title_ar: "عنوان", p_title_en: "Title", p_body_ar: "نص الاتفاقية التجريبي الطويل", p_body_en: "Long test agreement body text", p_is_draft: true, p_legal_review_note: null,
    });
    expect(asUser.error?.message).toContain("not_allowed");

    const notReviewed = await admin.client.rpc("admin_publish_agreement", {
      p_version_label: `t2-${runId}`, p_title_ar: "عنوان", p_title_en: "Title", p_body_ar: "نص الاتفاقية التجريبي الطويل", p_body_en: "Long test agreement body text", p_is_draft: false, p_legal_review_note: "",
    });
    expect(notReviewed.error?.message).toContain("legal_review_note_required");

    const v2 = await admin.client.rpc("admin_publish_agreement", {
      p_version_label: `t-${runId}`, p_title_ar: "عنوان", p_title_en: "Title", p_body_ar: "نص الاتفاقية التجريبي الطويل", p_body_en: "Long test agreement body text", p_is_draft: true, p_legal_review_note: null,
    });
    expect(v2.error).toBeNull();
    versionIds.push(v2.data as number);

    const listingId = await newListing(other, "Needs new acceptance", "sale");
    await other.client.rpc("accept_agreement", { p_listing_id: listingId });
    const ok = await other.client.rpc("change_listing_status", { p_listing_id: listingId, p_new_status: "pending_approval" });
    expect(ok.error).toBeNull(); // accepted the NEW current version

    const edit = await service.from("agreement_versions").select("body_ar").eq("id", originalVersionId).single();
    expect(edit.data!.body_ar).toContain("أقرّ باطلاعي"); // old text untouched
    const tamper = await admin.client.from("agreement_versions").update({ body_ar: "changed" }).eq("id", originalVersionId);
    expect(tamper.error).not.toBeNull();
  });
});
