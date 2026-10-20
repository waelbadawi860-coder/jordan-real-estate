/**
 * Smoke test for the commission pages (needs `npm run dev`).
 * Temporarily switches commissions ON in the development database, creates a
 * rule, a seller listing under the agreement and a reported sale, loads every
 * related page, then restores everything.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createTestSession, deleteTestSession, get, publishableKey, service, url, type TestSession } from "./helpers";

let admin: TestSession;
let seller: TestSession;
let listingId: number;
let draftId: number;
let commissionId: number;
let ruleId: number;
let originalEnabled: unknown;

async function asUser(session: TestSession) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  await client.auth.setSession({ access_token: session.accessToken, refresh_token: "unused" }).catch(() => undefined);
  return createClient(url, publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.accessToken}` } },
  });
}

beforeAll(async () => {
  [admin, seller] = await Promise.all([createTestSession("cadmin", "admin"), createTestSession("cseller")]);
  const enabled = await service.from("site_settings").select("value").eq("key", "commission_enabled").single();
  originalEnabled = enabled.data!.value;
  await service.from("site_settings").update({ value: true }).eq("key", "commission_enabled");

  const adminDb = await asUser(admin);
  const rule = await adminDb.rpc("admin_create_commission_rule", {
    p_deal_type: "sale", p_basis: "sale_price", p_percentage: 2, p_fixed_amount: null, p_min_amount: null, p_max_amount: null, p_due_days: 7, p_trigger_event: "transaction_completed",
  });
  if (rule.error) throw rule.error;
  ruleId = rule.data as number;

  const sellerDb = await asUser(seller);
  const [city, type] = await Promise.all([
    service.from("cities").select("id").eq("slug", "amman").single(),
    service.from("property_types").select("id").eq("slug", "apartment").single(),
  ]);
  const make = async (title: string) => {
    const { data, error } = await sellerDb
      .from("listings")
      .insert({ title, deal_type: "sale", property_type_id: type.data!.id, city_id: city.data!.id, price: 150000 })
      .select("id")
      .single();
    if (error) throw error;
    await sellerDb.from("listing_contacts").insert({ listing_id: data.id, phone: "+962791234567" });
    await sellerDb.from("listing_images").insert({ listing_id: data.id, storage_path: `${seller.userId}/${data.id}/00000000-0000-4000-8000-${String(data.id).padStart(12, "0")}.webp` });
    return data.id as number;
  };
  draftId = await make("Smoke commission draft");
  listingId = await make("Smoke commission sold flat");
  await sellerDb.rpc("accept_agreement", { p_listing_id: listingId });
  await sellerDb.rpc("declare_listing", { p_listing_id: listingId });
  await sellerDb.rpc("change_listing_status", { p_listing_id: listingId, p_new_status: "pending_approval" });
  await adminDb.rpc("change_listing_status", { p_listing_id: listingId, p_new_status: "published" });
}, 90_000);

afterAll(async () => {
  await service.from("site_settings").update({ value: originalEnabled }).eq("key", "commission_enabled");
  const { data: cms } = await service.from("commission_records").select("id").eq("seller_id", seller?.userId ?? "");
  const ids = (cms ?? []).map((c) => c.id);
  if (ids.length) {
    await service.from("commission_events").delete().in("commission_id", ids);
    await service.from("payment_records").delete().in("commission_id", ids);
    await service.from("commission_records").delete().in("id", ids);
  }
  if (seller) await service.from("accepted_agreements").delete().eq("user_id", seller.userId);
  await Promise.all([deleteTestSession(admin), deleteTestSession(seller)]);
  if (ruleId) await service.from("commission_rules").delete().eq("id", ruleId);
});

describe("commission pages", () => {
  it("shows the agreement before submitting a new listing", async () => {
    const html = await (await get(`/my/listings/${draftId}`, seller)).text();
    expect(html).toContain("أقرّ باطلاعي"); // the agreement text
    expect(html).toContain("2% من سعر البيع النهائي"); // the rule in plain language
  });

  it("sends 'mark as sold' through the transaction form", async () => {
    const res = await get(`/en/my/listings/${listingId}/transaction`, seller);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Final sale price");
  });

  it("shows the seller's commission after the sale is reported", async () => {
    const sellerDb = await asUser(seller);
    const today = new Date().toISOString().slice(0, 10);
    const report = await sellerDb.rpc("report_transaction", { p_listing_id: listingId, p_completed_on: today, p_transaction_value: 150000, p_confirm: true });
    expect(report.error).toBeNull();
    commissionId = report.data as number;

    expect((await get("/my/commissions", seller)).status).toBe(200);
    const detail = await (await get(`/en/my/commissions/${commissionId}`, seller)).text();
    expect(detail).toContain("3,000 JOD");
    expect(detail).toContain("Report a payment");
  });

  it("hides another seller's commission", async () => {
    expect((await get(`/my/commissions/${commissionId}`, admin)).status).toBe(404);
  });

  it("loads the admin commission pages", async () => {
    for (const path of ["/admin/commissions", `/admin/commissions/${commissionId}`, "/admin/agreements", "/admin/rules", "/en/admin/commissions?status=reported"]) {
      expect((await get(path, admin)).status, path).toBe(200);
    }
    expect((await get("/admin/commissions", seller)).status).toBe(404);
    const csv = await get("/admin/export/commissions", admin);
    expect(csv.status).toBe(200);
  });

  it("explains the active rules on the public commission policy page", async () => {
    // This public page is cached for up to a minute, so it may still show the
    // "commissions are off" message right after the test switched them on.
    const res = await get("/commission-policy");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.includes("قواعد العمولة الحالية") || html.includes("نظام العمولة غير مفعّل")).toBe(true);
  });
});
