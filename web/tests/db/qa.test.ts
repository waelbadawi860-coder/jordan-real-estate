/**
 * Pre-launch QA matrix (2026-10-27): edge cases, role boundaries and data
 * integrity beyond the happy paths, against the DEVELOPMENT database.
 *   npx vitest run tests/db/qa.test.ts
 * Each test states the behaviour the platform is meant to have today.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmTwoStep } from "../totp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, noSession);
const anon = createClient(url, publishableKey, noSession);
const runId = randomUUID().slice(0, 8);

type U = { id: string; email: string; password: string; client: SupabaseClient };
const users: U[] = [];

async function createUser(name: string, role: "user" | "admin" = "user"): Promise<U> {
  const email = `test-${runId}-qa-${name}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `QA ${name}` } });
  if (error) throw error;
  if (role === "admin") await service.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  const client = createClient(url, publishableKey, noSession);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  if (role === "admin") await confirmTwoStep(client);
  const consent = await client.rpc("accept_current_terms");
  if (consent.error) throw consent.error;
  const user = { id: data.user.id, email, password, client };
  users.push(user);
  return user;
}

let seller: U;
let buyer: U;
let reporter2: U;
let reporter3: U;
let admin1: U;
let admin2: U;
let cityId: number;
let hoodId: number;
let apartmentId: number;

/** A published listing created directly (as the seed scripts do), owned by `owner`. */
async function publishedListing(owner: U, title: string, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  const { data, error } = await service
    .from("listings")
    .insert({
      seller_id: owner.id,
      title: `${title} ${runId}`,
      deal_type: "sale",
      property_type_id: apartmentId,
      city_id: cityId,
      neighborhood_id: hoodId,
      price: 90000,
      area_sqm: 150,
      bedrooms: 3,
      bathrooms: 2,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  // New ads always start as drafts; publish in a second step.
  const pub = await service
    .from("listings")
    .update({ status: "published", published_at: new Date(now).toISOString(), expires_at: new Date(now + 30 * 86_400_000).toISOString() })
    .eq("id", data.id);
  if (pub.error) throw pub.error;
  return data.id as number;
}

const publicIds = async (ids: number[]) =>
  ((await anon.from("listings").select("id").in("id", ids)).data ?? []).map((r) => r.id);

beforeAll(async () => {
  const [city, type] = await Promise.all([
    service.from("cities").select("id").eq("slug", "amman").single(),
    service.from("property_types").select("id").eq("slug", "apartment").single(),
  ]);
  cityId = city.data!.id;
  apartmentId = type.data!.id;
  hoodId = (await service.from("neighborhoods").select("id").eq("city_id", cityId).eq("slug", "khalda").single()).data!.id;
  // One at a time: sign-ins are rate limited.
  seller = await createUser("seller");
  buyer = await createUser("buyer");
  reporter2 = await createUser("reporter2");
  reporter3 = await createUser("reporter3");
  admin1 = await createUser("admin1", "admin");
  admin2 = await createUser("admin2", "admin");
}, 120_000);

afterAll(async () => {
  const ids = users.map((u) => u.id);
  if (ids.length) await service.from("listings").delete().in("seller_id", ids);
  const { data: files } = await service.storage.from("office-documents").list(reporter2?.id ?? "none");
  if (files?.length) await service.storage.from("office-documents").remove(files.map((f) => `${reporter2.id}/${f.name}`));
  for (const id of ids) await service.auth.admin.deleteUser(id);
}, 120_000);

describe("1. listing lifecycle", () => {
  it("editing the price of an approved ad sends it back to review and hides it", async () => {
    const id = await publishedListing(seller, "QA edit after approval");
    const { error } = await seller.client.from("listings").update({ price: 1 }).eq("id", id);
    expect(error).toBeNull();
    const { data } = await service.from("listings").select("status").eq("id", id).single();
    expect(data!.status).toBe("pending_approval");
    expect(await publicIds([id])).toEqual([]);
  });

  it("refuses a photo beyond the maximum per ad", async () => {
    const { data: draft } = await seller.client
      .from("listings")
      .insert({ title: `QA photo limit ${runId}`, deal_type: "sale", property_type_id: apartmentId, city_id: cityId, neighborhood_id: hoodId, price: 1000 })
      .select("id")
      .single();
    const { data: setting } = await service.from("site_settings").select("value").eq("key", "max_images_per_listing").single();
    const max = Number(setting!.value);
    const rows = Array.from({ length: max }, (_, n) => ({ listing_id: draft!.id, storage_path: `${seller.id}/${draft!.id}/${randomUUID()}.webp`, position: n }));
    const ok = await seller.client.from("listing_images").insert(rows);
    expect(ok.error).toBeNull();
    const extra = await seller.client
      .from("listing_images")
      .insert({ listing_id: draft!.id, storage_path: `${seller.id}/${draft!.id}/${randomUUID()}.webp`, position: max });
    expect(extra.error?.message).toContain("image_limit_reached");
  });

  it("rejects photo files over the size limit (5 MB)", async () => {
    const { data: draft } = await seller.client
      .from("listings")
      .insert({ title: `QA big photo ${runId}`, deal_type: "sale", property_type_id: apartmentId, city_id: cityId, neighborhood_id: hoodId, price: 1000 })
      .select("id")
      .single();
    const big = new Uint8Array(5 * 1024 * 1024 + 1024);
    const { error } = await seller.client.storage
      .from("listing-photos")
      .upload(`${seller.id}/${draft!.id}/${randomUUID()}.webp`, big, { contentType: "image/webp" });
    expect(error).not.toBeNull();
  });

  it("a withdrawn ad leaves the feed and other people's favourites, but the favourite row doesn't break anything", async () => {
    const id = await publishedListing(seller, "QA withdraw");
    const fav = await buyer.client.from("favourites").insert({ listing_id: id });
    expect(fav.error).toBeNull();
    const withdraw = await seller.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "withdrawn" });
    expect(withdraw.error).toBeNull();
    expect(await publicIds([id])).toEqual([]);
    // The buyer's favourites list joins to the listing: it comes back empty for this ad.
    const { data } = await buyer.client.from("favourites").select("listing_id, listings(id, title)").eq("listing_id", id);
    expect(data?.[0]?.listings ?? null).toBeNull();
  });

  it("an ad an admin rejects or holds disappears from the feed straight away", async () => {
    const held = await publishedListing(seller, "QA hold");
    const hold = await admin1.client.rpc("change_listing_status", { p_listing_id: held, p_new_status: "on_hold", p_reason: "QA complaint" });
    expect(hold.error).toBeNull();
    expect(await publicIds([held])).toEqual([]);
  });

  it("two reports keep the ad up; a third different user puts it on hold and tells the seller and admins", async () => {
    const id = await publishedListing(seller, "QA reported");
    for (const r of [buyer, reporter2]) {
      const { error } = await r.client.from("listing_reports").insert({ listing_id: id, reason: "fraud", details: "QA" });
      expect(error).toBeNull();
    }
    expect(await publicIds([id])).toEqual([id]);
    // The same person can't report twice to push it over the line.
    const again = await buyer.client.from("listing_reports").insert({ listing_id: id, reason: "fraud" });
    expect(again.error).not.toBeNull();
    expect(await publicIds([id])).toEqual([id]);

    const third = await reporter3.client.from("listing_reports").insert({ listing_id: id, reason: "fraud", details: "QA" });
    expect(third.error).toBeNull();
    const { count } = await admin1.client.from("listing_reports").select("id", { count: "exact", head: true }).eq("listing_id", id);
    expect(count).toBe(3);
    expect((await service.from("listings").select("status").eq("id", id).single()).data!.status).toBe("on_hold");
    expect(await publicIds([id])).toEqual([]);

    const { data: history } = await service.from("listing_status_history").select("to_status, reason").eq("listing_id", id).order("id", { ascending: false }).limit(1);
    expect(history![0]).toMatchObject({ to_status: "on_hold", reason: "auto_hold_reports" });
    const sellerNote = await seller.client.from("notifications").select("type, data").eq("type", "listing_status_changed").contains("data", { listing_id: id });
    expect(sellerNote.data).toHaveLength(1);
    const adminNote = await admin1.client.from("notifications").select("type").eq("type", "listing_auto_held").contains("data", { listing_id: id });
    expect(adminNote.data).toHaveLength(1);
    // An admin can release it unchanged.
    const release = await admin1.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "published" });
    expect(release.error).toBeNull();
    expect(await publicIds([id])).toEqual([id]);
  });
});

describe("2. roles and suspension", () => {
  it("a suspended user can't post or edit, but their published ads stay public unless the admin takes them down", async () => {
    const victim = await createUser("suspended");
    const id = await publishedListing(victim, "QA suspended seller");
    const suspend = await admin1.client.rpc("admin_set_user_status", { p_user_id: victim.id, p_status: "suspended", p_reason: "QA" });
    expect(suspend.error).toBeNull();
    // Writes are refused with the session they already have.
    const create = await victim.client
      .from("listings")
      .insert({ title: `QA after suspension ${runId}`, deal_type: "sale", property_type_id: apartmentId, city_id: cityId, neighborhood_id: hoodId, price: 1000 })
      .select("id");
    expect(create.error).not.toBeNull();
    const edit = await victim.client.from("listings").update({ title: "changed" }).eq("id", id).select("id");
    expect(edit.data ?? []).toHaveLength(0);
    // The ad itself is still visible (takedown is a separate admin choice).
    expect(await publicIds([id])).toEqual([id]);
    // And the account can still sign in (it is not banned at login level).
    const again = await createClient(url, publishableKey, noSession).auth.signInWithPassword({ email: victim.email, password: victim.password });
    expect(again.error).toBeNull();
  });

  it("user B can't change, withdraw or delete user A's ad by its number", async () => {
    const id = await publishedListing(seller, "QA idor");
    const upd = await buyer.client.from("listings").update({ price: 1 }).eq("id", id).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    const status = await buyer.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "withdrawn" });
    expect(status.error).not.toBeNull();
    const del = await buyer.client.from("listings").delete().eq("id", id).select("id");
    expect(del.data ?? []).toHaveLength(0);
    const photo = await buyer.client.from("listing_images").insert({ listing_id: id, storage_path: `${buyer.id}/${id}/${randomUUID()}.webp` });
    expect(photo.error).not.toBeNull();
    expect(await publicIds([id])).toEqual([id]);
  });

  it("office verification: only an admin can approve it, and the badge has an end date", async () => {
    const { data: office, error } = await service
      .from("offices")
      .insert({ owner_id: reporter2.id, name: `QA office ${runId}` })
      .select("id")
      .single();
    expect(error).toBeNull();
    // Commercial registration, licence and ID: three private files.
    const docs: string[] = [];
    for (let n = 0; n < 3; n++) {
      const path = `${reporter2.id}/${randomUUID()}.pdf`;
      const up = await reporter2.client.storage.from("office-documents").upload(path, new TextEncoder().encode("%PDF-1.4 QA"), { contentType: "application/pdf" });
      expect(up.error).toBeNull();
      docs.push(path);
    }
    const submit = await reporter2.client.rpc("submit_office_verification", { p_commercial_reg_no: "123456", p_license_no: "L-7890", p_documents: docs });
    expect(submit.error).toBeNull();
    // Visitors and other users can't read the documents.
    const peek = await buyer.client.storage.from("office-documents").download(docs[0]);
    expect(peek.error).not.toBeNull();
    const { data: request } = await service.from("office_verifications").select("id").eq("office_id", office!.id).single();
    const selfApprove = await reporter2.client.rpc("admin_review_office_verification", { p_request_id: request!.id, p_approve: true, p_reason: null });
    expect(selfApprove.error).not.toBeNull();
    const approve = await admin1.client.rpc("admin_review_office_verification", { p_request_id: request!.id, p_approve: true, p_reason: null });
    expect(approve.error).toBeNull();
    const { data: after } = await service.from("offices").select("verified_until").eq("id", office!.id).single();
    expect(Date.parse(after!.verified_until!)).toBeGreaterThan(Date.now() + 300 * 86_400_000);
  });
});

describe("3. promotions", () => {
  it("admins can grant, extend and revoke 'featured', and each step is recorded with the admin's name", async () => {
    const id = await publishedListing(seller, "QA promo");
    const grant = await admin1.client.rpc("admin_promote_listing", { p_listing_id: id, p_kind: "feature", p_days: 1, p_amount: 5, p_payment_ref: "CLIQ-QA-1" });
    expect(grant.error).toBeNull();
    const first = (await service.from("listings").select("featured_until").eq("id", id).single()).data!.featured_until!;
    const extend = await admin2.client.rpc("admin_promote_listing", { p_listing_id: id, p_kind: "feature", p_days: 2, p_amount: 9 });
    expect(extend.error).toBeNull();
    const second = (await service.from("listings").select("featured_until").eq("id", id).single()).data!.featured_until!;
    // Extending adds to the remaining time, it doesn't restart it.
    expect(Date.parse(second) - Date.parse(first)).toBeGreaterThan(2 * 86_400_000 - 60_000);
    const revoke = await admin1.client.rpc("admin_promote_listing", { p_listing_id: id, p_kind: "unfeature", p_note: "QA dispute" });
    expect(revoke.error).toBeNull();
    expect((await service.from("listings").select("featured_until").eq("id", id).single()).data!.featured_until).toBeNull();
    const { data: log } = await service.from("listing_promotions").select("kind, created_by, amount").eq("listing_id", id).order("id");
    expect(log!.map((r) => [r.kind, r.created_by])).toEqual([
      ["feature", admin1.id],
      ["feature", admin2.id],
      ["unfeature", admin1.id],
    ]);
    const sellerTry = await seller.client.rpc("admin_promote_listing", { p_listing_id: id, p_kind: "feature", p_days: 30 });
    expect(sellerTry.error).not.toBeNull();
  });

  it("a featured ad stops counting as featured the moment its time is up", async () => {
    const id = await publishedListing(seller, "QA expiry", { featured_until: new Date(Date.now() + 3000).toISOString() });
    const featuredNow = await anon.from("listings").select("id").eq("id", id).gt("featured_until", new Date().toISOString());
    expect(featuredNow.data).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 3500));
    const featuredLater = await anon.from("listings").select("id").eq("id", id).gt("featured_until", new Date().toISOString());
    expect(featuredLater.data).toHaveLength(0);
  });

  it("featured times are stored as exact moments (UTC), so Jordan time is just how they are shown", async () => {
    const id = await publishedListing(seller, "QA tz");
    await admin1.client.rpc("admin_promote_listing", { p_listing_id: id, p_kind: "feature", p_days: 7 });
    const until = (await service.from("listings").select("featured_until").eq("id", id).single()).data!.featured_until!;
    const hours = (Date.parse(until) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(7 * 24 - 0.1);
    expect(hours).toBeLessThan(7 * 24 + 0.1);
  });
});

describe("4. search and map", () => {
  it("refuses map pins outside Jordan and accepts one in Aqaba", async () => {
    const outside = await service
      .from("listings")
      .insert({ seller_id: seller.id, title: `QA pin out ${runId}`, deal_type: "sale", property_type_id: apartmentId, city_id: cityId, price: 1000, latitude: 40.1, longitude: 44.5 });
    expect(outside.error).not.toBeNull();
    const aqaba = await service
      .from("listings")
      .insert({ seller_id: seller.id, title: `QA pin aqaba ${runId}`, deal_type: "sale", property_type_id: apartmentId, city_id: cityId, price: 1000, latitude: 29.532, longitude: 35.006 });
    expect(aqaba.error).toBeNull();
  });

  it("contradictory filters return an empty list, not an error", async () => {
    const { data, error } = await anon.from("listings").select("id").gte("area_sqm", 9_000_000).lte("price", 1).limit(20);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("5. admin control", () => {
  it("records which admin did what", async () => {
    const id = await publishedListing(seller, "QA audit");
    await admin1.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "on_hold", p_reason: "QA audit hold" });
    await admin2.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "published" });
    const { data } = await service
      .from("admin_audit_logs")
      .select("actor_id, action, details")
      .eq("entity_id", String(id))
      .order("id");
    const actors = (data ?? []).map((r) => r.actor_id);
    expect(actors).toContain(admin1.id);
    expect(actors).toContain(admin2.id);
  });

  it("dashboard counters move with new ads and reports", async () => {
    const before = (await admin1.client.rpc("admin_overview")).data as Record<string, number>;
    const id = await publishedListing(seller, "QA counters");
    await buyer.client.from("listing_reports").insert({ listing_id: id, reason: "wrong_info" });
    const after = (await admin1.client.rpc("admin_overview")).data as Record<string, number>;
    // Other tests may run at the same time, so "at least one more".
    expect(after.live_listings).toBeGreaterThanOrEqual(before.live_listings + 1);
    expect(after.open_listing_reports).toBeGreaterThanOrEqual(before.open_listing_reports + 1);
    // Income from paid services is counted (featured for 5 JD).
    await admin1.client.rpc("admin_promote_listing", { p_listing_id: id, p_kind: "feature", p_days: 7, p_amount: 5, p_payment_ref: "CLIQ-QA-2" });
    const paid = (await admin1.client.rpc("admin_overview")).data as Record<string, number>;
    expect(Number(paid.revenue_month)).toBeGreaterThanOrEqual(Number(after.revenue_month) + 5);
    expect(Number(paid.revenue_total)).toBeGreaterThanOrEqual(Number(after.revenue_total) + 5);
    expect(paid.featured_now).toBeGreaterThanOrEqual(after.featured_now + 1);
    const visitorTry = await anon.rpc("admin_overview");
    expect(visitorTry.error).not.toBeNull();
  });
});

describe("6. indicators and saved searches", () => {
  it("indicators: review time, rejections and holds come from the status history; admins only", async () => {
    // Submitted, then approved by an admin about now.
    const { data: draft } = await service
      .from("listings")
      .insert({ seller_id: seller.id, title: `QA kpi ${runId}`, deal_type: "sale", property_type_id: apartmentId, city_id: cityId, neighborhood_id: hoodId, price: 1000 })
      .select("id")
      .single();
    await service.from("listings").update({ status: "pending_approval", submitted_at: new Date().toISOString() }).eq("id", draft!.id);
    const approve = await admin1.client.rpc("change_listing_status", { p_listing_id: draft!.id, p_new_status: "published" });
    expect(approve.error).toBeNull();

    const { data, error } = await admin1.client.rpc("admin_kpis", { p_days: 7 });
    expect(error).toBeNull();
    const k = data as Record<string, unknown>;
    expect(k.days).toBe(7);
    expect(Number(k.submitted)).toBeGreaterThanOrEqual(1);
    expect(Number(k.approved)).toBeGreaterThanOrEqual(1);
    expect(k.review_hours_median).not.toBeNull();
    expect(typeof k.flags).toBe("object");
    expect((await buyer.client.rpc("admin_kpis", { p_days: 7 })).error).not.toBeNull();
    expect((await anon.rpc("admin_kpis", { p_days: 7 })).error).not.toBeNull();
  });

  it("a saved search with a maximum price and 'owner only' is told only about matching ads", async () => {
    const save = await buyer.client
      .from("saved_searches")
      .insert({ user_id: buyer.id, deal_type: "sale", city_id: cityId, max_price: 100000, owner_only: true })
      .select("id")
      .single();
    expect(save.error).toBeNull();
    const hits = async (listingId: number) =>
      (await service.from("saved_search_hits").select("listing_id").eq("saved_search_id", save.data!.id).eq("listing_id", listingId)).data ?? [];

    const match = await publishedListing(seller, "QA alert match", { price: 95000, poster_type: "owner" });
    const tooDear = await publishedListing(seller, "QA alert dear", { price: 150000, poster_type: "owner" });
    const broker = await publishedListing(seller, "QA alert broker", { price: 90000, poster_type: "agent" });
    expect(await hits(match)).toHaveLength(1);
    expect(await hits(tooDear)).toHaveLength(0);
    expect(await hits(broker)).toHaveLength(0);
    const notes = await buyer.client.from("notifications").select("data").eq("type", "similar_listing");
    const ids = (notes.data ?? []).map((n) => (n.data as { listing_id: number }).listing_id);
    expect(ids).toContain(match);
    expect(ids).not.toContain(tooDear);
    expect(ids).not.toContain(broker);

    // The same search twice is one entry; a plain follow of the same area is a separate one.
    const again = await buyer.client.from("saved_searches").insert({ user_id: buyer.id, deal_type: "sale", city_id: cityId, max_price: 100000, owner_only: true });
    expect(again.error?.code).toBe("23505");
    const plain = await buyer.client.from("saved_searches").insert({ user_id: buyer.id, deal_type: "sale", city_id: cityId });
    expect(plain.error).toBeNull();
    await service.from("saved_searches").delete().eq("user_id", buyer.id);
  });
});

describe("7. monitoring", () => {
  it("only the server records failures; only admins read them; too many in 15 minutes alert the admins once", async () => {
    expect((await anon.rpc("record_system_event", { p_kind: "server_error", p_source: "x" })).error).not.toBeNull();
    expect((await buyer.client.rpc("record_system_event", { p_kind: "server_error", p_source: "x" })).error).not.toBeNull();
    expect((await service.rpc("record_system_event", { p_kind: "made_up", p_source: "x" })).error).not.toBeNull();

    const before = (await service.from("site_settings").select("value").eq("key", "alert_failures_per_15min").single()).data!.value;
    const tag = `qa-${runId}`;
    try {
      // A low threshold just for this test.
      await service.from("site_settings").update({ value: 2 }).eq("key", "alert_failures_per_15min");
      await service.from("notifications").delete().eq("type", "system_failures");
      for (let i = 0; i < 3; i++) {
        const r = await service.rpc("record_system_event", { p_kind: "photo_upload_failed", p_source: tag, p_detail: "network" });
        expect(r.error).toBeNull();
      }
      const seen = await admin1.client.from("system_events").select("id").eq("source", tag);
      expect(seen.data).toHaveLength(3);
      expect((await buyer.client.from("system_events").select("id").eq("source", tag)).data ?? []).toHaveLength(0);
      const alerts = await admin1.client.from("notifications").select("id").eq("type", "system_failures");
      expect(alerts.data).toHaveLength(1); // one alert, not one per failure
    } finally {
      await service.from("site_settings").update({ value: before }).eq("key", "alert_failures_per_15min");
      await service.from("system_events").delete().eq("source", tag);
      await service.from("notifications").delete().eq("type", "system_failures");
    }
  });
});
