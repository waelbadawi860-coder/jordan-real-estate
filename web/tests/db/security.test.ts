/**
 * Database security tests (run against the DEVELOPMENT Supabase project only).
 *
 * Creates temporary users — anonymous visitor, two ordinary users, a suspended
 * user and an admin — then checks what each one can and cannot do.
 * Everything created here is deleted at the end.
 *
 * Run with:  npm run test:db
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

if (!url || !publishableKey || !secretKey) {
  throw new Error("Fill in web/.env.local before running database tests.");
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secretKey, noSession);
const anon = createClient(url, publishableKey, noSession);

const runId = randomUUID().slice(0, 8);

type TestUser = { id: string; email: string; client: SupabaseClient };

async function createUser(name: string): Promise<TestUser> {
  const email = `test-${runId}-${name}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Test ${name}` },
  });
  if (error) throw error;

  const client = createClient(url, publishableKey, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

let alice: TestUser;
let bob: TestUser;
let carol: TestUser; // suspended
let admin: TestUser;
let cityId: number;
let neighborhoodId: number;
let apartmentTypeId: number;
const uploadedFiles: string[] = [];

function listingInput(title: string, dealType: "sale" | "rent" = "sale") {
  return {
    title,
    description: "Test listing created by automated security tests.",
    deal_type: dealType,
    property_type_id: apartmentTypeId,
    city_id: cityId,
    neighborhood_id: neighborhoodId,
    price: "125000.500",
    area_sqm: 150,
    bedrooms: 3,
    bathrooms: 2,
  };
}

async function createListing(user: TestUser, title: string, dealType: "sale" | "rent" = "sale") {
  const { data, error } = await user.client
    .from("listings")
    .insert(listingInput(title, dealType))
    .select("id, status, seller_id")
    .single();
  if (error) throw error;
  return data as { id: number; status: string; seller_id: string };
}

/** Adds a contact + one image row so the listing can be submitted. */
async function makeSubmittable(user: TestUser, listingId: number) {
  const contact = await user.client
    .from("listing_contacts")
    .insert({ listing_id: listingId, phone: "+962791234567" });
  if (contact.error) throw contact.error;
  const image = await user.client.from("listing_images").insert({
    listing_id: listingId,
    storage_path: `${user.id}/${listingId}/${randomUUID()}.webp`,
  });
  if (image.error) throw image.error;
}

async function statusOf(listingId: number) {
  const { data } = await service.from("listings").select("status").eq("id", listingId).single();
  return data?.status;
}

beforeAll(async () => {
  const [city, type] = await Promise.all([
    service.from("cities").select("id").eq("slug", "amman").single(),
    service.from("property_types").select("id").eq("slug", "apartment").single(),
  ]);
  cityId = city.data!.id;
  apartmentTypeId = type.data!.id;
  const hood = await service
    .from("neighborhoods")
    .select("id")
    .eq("city_id", cityId)
    .eq("slug", "abdoun")
    .single();
  neighborhoodId = hood.data!.id;

  alice = await createUser("alice");
  bob = await createUser("bob");
  carol = await createUser("carol");
  admin = await createUser("admin");

  await service.from("profiles").update({ status: "suspended" }).eq("id", carol.id);
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);
});

afterAll(async () => {
  const userIds = [alice, bob, carol, admin].filter(Boolean).map((u) => u.id);
  if (uploadedFiles.length) {
    await service.storage.from("listing-photos").remove(uploadedFiles);
  }
  await service.from("listings").delete().in("seller_id", userIds);
  for (const id of userIds) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("profiles", () => {
  it("anonymous visitors cannot read any profile", async () => {
    const { data } = await anon.from("profiles").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("a profile is created automatically on registration", async () => {
    const { data } = await alice.client.from("profiles").select("display_name, role, status").single();
    expect(data).toEqual({ display_name: "Test alice", role: "user", status: "active" });
  });

  it("users read only their own profile", async () => {
    const { data } = await alice.client.from("profiles").select("id");
    expect(data!.map((p) => p.id)).toEqual([alice.id]);
  });

  it("users can update their name but not their role or status", async () => {
    const ok = await alice.client.from("profiles").update({ display_name: "Alice" }).eq("id", alice.id);
    expect(ok.error).toBeNull();

    const role = await alice.client.from("profiles").update({ role: "admin" }).eq("id", alice.id);
    expect(role.error?.code).toBe("42501");
    const status = await carol.client.from("profiles").update({ status: "active" }).eq("id", carol.id);
    expect(status.error?.code).toBe("42501");
  });

  it("users cannot change another user's profile", async () => {
    await bob.client.from("profiles").update({ display_name: "Hacked" }).eq("id", alice.id);
    const { data } = await service.from("profiles").select("display_name").eq("id", alice.id).single();
    expect(data!.display_name).toBe("Alice");
  });

  it("admins can read all profiles", async () => {
    const { data } = await admin.client.from("profiles").select("id").in("id", [alice.id, bob.id]);
    expect(data).toHaveLength(2);
  });

  it("only admins can suspend accounts, with a reason, and it is audited", async () => {
    const denied = await alice.client.rpc("admin_set_user_status", {
      p_user_id: bob.id,
      p_status: "suspended",
      p_reason: "test",
    });
    expect(denied.error?.message).toContain("not_allowed");

    const ok = await admin.client.rpc("admin_set_user_status", {
      p_user_id: bob.id,
      p_status: "suspended",
      p_reason: "Automated test",
    });
    expect(ok.error).toBeNull();
    const back = await admin.client.rpc("admin_set_user_status", {
      p_user_id: bob.id,
      p_status: "active",
      p_reason: "Automated test reverted",
    });
    expect(back.error).toBeNull();

    const log = await admin.client
      .from("admin_audit_logs")
      .select("action")
      .eq("entity_id", bob.id)
      .eq("action", "user_status_change");
    expect(log.data).toHaveLength(2);
  });
});

describe("listings: ownership and visibility", () => {
  let draftId: number;

  beforeAll(async () => {
    draftId = (await createListing(alice, "Alice draft apartment")).id;
  });

  it("new listings start as drafts owned by the creator", async () => {
    const { data } = await alice.client.from("listings").select("status, seller_id").eq("id", draftId).single();
    expect(data).toEqual({ status: "draft", seller_id: alice.id });
  });

  it("drafts are invisible to visitors and other users, visible to admins", async () => {
    expect((await anon.from("listings").select("id").eq("id", draftId)).data).toHaveLength(0);
    expect((await bob.client.from("listings").select("id").eq("id", draftId)).data).toHaveLength(0);
    expect((await admin.client.from("listings").select("id").eq("id", draftId)).data).toHaveLength(1);
  });

  it("users cannot create a listing in someone else's name", async () => {
    const { error } = await alice.client
      .from("listings")
      .insert({ ...listingInput("Forged owner listing"), seller_id: bob.id });
    expect(error?.code).toBe("42501");
  });

  it("users cannot create a listing that is already published", async () => {
    const { error } = await alice.client
      .from("listings")
      .insert({ ...listingInput("Forged published listing"), status: "published" });
    expect(error?.code).toBe("42501");
  });

  it("other users cannot edit or delete someone else's listing", async () => {
    await bob.client.from("listings").update({ title: "Hacked title" }).eq("id", draftId);
    await bob.client.from("listings").delete().eq("id", draftId);
    const { data } = await service.from("listings").select("title").eq("id", draftId).single();
    expect(data!.title).toBe("Alice draft apartment");
  });

  it("users cannot change listing status directly", async () => {
    const { error } = await alice.client.from("listings").update({ status: "published" }).eq("id", draftId);
    expect(error?.code).toBe("42501");
  });

  it("suspended users cannot create listings", async () => {
    const { error } = await carol.client.from("listings").insert(listingInput("Suspended user listing"));
    expect(error?.code).toBe("42501");
  });

  it("anonymous visitors cannot create listings", async () => {
    const { error } = await anon.from("listings").insert(listingInput("Anonymous listing"));
    expect(error).not.toBeNull();
  });
});

describe("listings: approval workflow", () => {
  let id: number;

  beforeAll(async () => {
    id = (await createListing(alice, "Alice apartment for approval")).id;
  });

  it("cannot be submitted without contact details and a photo", async () => {
    const { error } = await alice.client.rpc("change_listing_status", {
      p_listing_id: id,
      p_new_status: "pending_approval",
    });
    expect(error?.message).toContain("contact_required");
  });

  it("owner submits; owner cannot approve their own listing", async () => {
    await makeSubmittable(alice, id);
    const submit = await alice.client.rpc("change_listing_status", {
      p_listing_id: id,
      p_new_status: "pending_approval",
    });
    expect(submit.error).toBeNull();
    expect(submit.data).toBe("pending_approval");

    const approve = await alice.client.rpc("change_listing_status", {
      p_listing_id: id,
      p_new_status: "published",
    });
    expect(approve.error?.message).toContain("invalid_status_transition");
  });

  it("other users cannot change the status of someone else's listing", async () => {
    const { error } = await bob.client.rpc("change_listing_status", {
      p_listing_id: id,
      p_new_status: "withdrawn",
    });
    expect(error?.message).toContain("listing_not_found");
  });

  it("rejection requires a reason", async () => {
    const { error } = await admin.client.rpc("change_listing_status", {
      p_listing_id: id,
      p_new_status: "rejected",
    });
    expect(error?.message).toContain("reason_required");
  });

  it("admin approves; listing becomes public with a 30-day expiry and the action is audited", async () => {
    const { data, error } = await admin.client.rpc("change_listing_status", {
      p_listing_id: id,
      p_new_status: "published",
    });
    expect(error).toBeNull();
    expect(data).toBe("published");

    const pub = await anon.from("listings").select("id, published_at, expires_at").eq("id", id).single();
    expect(pub.data).not.toBeNull();
    const days =
      (new Date(pub.data!.expires_at).getTime() - new Date(pub.data!.published_at).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);

    const images = await anon.from("listing_images").select("id").eq("listing_id", id);
    expect(images.data).toHaveLength(1);

    const audit = await admin.client
      .from("admin_audit_logs")
      .select("action")
      .eq("entity_type", "listing")
      .eq("entity_id", String(id));
    expect(audit.data!.map((a) => a.action)).toContain("listing_status_change");

    const notes = await alice.client.from("notifications").select("type").eq("data->>listing_id", String(id));
    expect(notes.data!.map((n) => n.type)).toContain("listing_status_changed");
  });

  it("history records every status change", async () => {
    const { data } = await alice.client
      .from("listing_status_history")
      .select("to_status")
      .eq("listing_id", id)
      .order("id");
    expect(data!.map((h) => h.to_status)).toEqual(["draft", "pending_approval", "published"]);
  });

  it("seller phone numbers are never readable through the public API", async () => {
    const direct = await anon.from("listing_contacts").select("phone").eq("listing_id", id);
    expect(direct.data ?? []).toHaveLength(0);
    const otherUser = await bob.client.from("listing_contacts").select("phone").eq("listing_id", id);
    expect(otherUser.data ?? []).toHaveLength(0);
    const rpc = await anon.rpc("get_listing_contact", { p_listing_id: id });
    expect(rpc.error).not.toBeNull();
    const rpcUser = await bob.client.rpc("get_listing_contact", { p_listing_id: id });
    expect(rpcUser.error).not.toBeNull();

    // Trusted server code can read it (after applying its own rate limits).
    const server = await service.rpc("get_listing_contact", { p_listing_id: id });
    expect(server.data).toEqual([{ phone: "+962791234567", allow_calls: true, allow_whatsapp: true }]);
  });

  it("editing a published listing sends it back for approval", async () => {
    const edit = await alice.client.from("listings").update({ price: "1.000" }).eq("id", id);
    expect(edit.error).toBeNull();
    expect(await statusOf(id)).toBe("pending_approval");
    expect((await anon.from("listings").select("id").eq("id", id)).data).toHaveLength(0);

    await admin.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "published" });
    expect(await statusOf(id)).toBe("published");
  });

  it("a sale listing cannot be marked as rented", async () => {
    const { error } = await alice.client.rpc("change_listing_status", {
      p_listing_id: id,
      p_new_status: "rented",
    });
    expect(error?.message).toContain("rented_requires_rent_listing");
  });

  it("expired listings disappear from public results; the expiry job is not public", async () => {
    const denied = await anon.rpc("expire_listings");
    expect(denied.error).not.toBeNull();
    const deniedUser = await alice.client.rpc("expire_listings");
    expect(deniedUser.error).not.toBeNull();

    await service
      .from("listings")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", id);
    expect((await anon.from("listings").select("id").eq("id", id)).data).toHaveLength(0);

    const run = await service.rpc("expire_listings");
    expect(run.error).toBeNull();
    expect(await statusOf(id)).toBe("expired");
  });

  it("owner can renew an expired listing", async () => {
    const { error } = await alice.client.rpc("renew_listing", { p_listing_id: id });
    expect(error).toBeNull();
    expect(await statusOf(id)).toBe("published");
  });

  it("owner can withdraw, then archive; drafts only can be deleted", async () => {
    const del = await alice.client.from("listings").delete().eq("id", id);
    expect(del.error).toBeNull();
    expect(await statusOf(id)).toBe("published"); // not deleted

    await alice.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "withdrawn" });
    expect(await statusOf(id)).toBe("withdrawn");
    await alice.client.rpc("change_listing_status", { p_listing_id: id, p_new_status: "archived" });
    expect(await statusOf(id)).toBe("archived");
  });
});

describe("favourites", () => {
  let publishedId: number;
  let draftId: number;

  beforeAll(async () => {
    publishedId = (await createListing(bob, "Bob published villa")).id;
    await makeSubmittable(bob, publishedId);
    await bob.client.rpc("change_listing_status", { p_listing_id: publishedId, p_new_status: "pending_approval" });
    await admin.client.rpc("change_listing_status", { p_listing_id: publishedId, p_new_status: "published" });
    draftId = (await createListing(bob, "Bob draft villa")).id;
  });

  it("users can save published listings but not drafts", async () => {
    const ok = await alice.client.from("favourites").insert({ listing_id: publishedId });
    expect(ok.error).toBeNull();
    const bad = await alice.client.from("favourites").insert({ listing_id: draftId });
    expect(bad.error?.code).toBe("42501");
  });

  it("favourites are private to their owner", async () => {
    expect((await alice.client.from("favourites").select("listing_id")).data).toHaveLength(1);
    expect((await bob.client.from("favourites").select("listing_id")).data).toHaveLength(0);
    expect((await anon.from("favourites").select("listing_id")).data ?? []).toHaveLength(0);
  });

  it("users can report a published listing once while it is open", async () => {
    const first = await alice.client.from("listing_reports").insert({ listing_id: publishedId, reason: "wrong_info" });
    expect(first.error).toBeNull();
    const again = await alice.client.from("listing_reports").insert({ listing_id: publishedId, reason: "fraud" });
    expect(again.error).not.toBeNull();
    const seen = await bob.client.from("listing_reports").select("id").eq("listing_id", publishedId);
    expect(seen.data).toHaveLength(0);
  });
});

describe("anti-spam limits", () => {
  it("blocks an identical listing title submitted twice within 10 minutes", async () => {
    await createListing(bob, "Duplicate test flat");
    const { error } = await bob.client.from("listings").insert(listingInput("Duplicate test flat"));
    expect(error?.message).toContain("duplicate_listing");
  });

  it("blocks more than 3 new listings per user in 24 hours", async () => {
    // Bob has already created 3 listings in this test run.
    const { error } = await bob.client.from("listings").insert(listingInput("Bob fourth listing"));
    expect(error?.message).toContain("listing_limit_reached");
  });
});

describe("settings and reference data", () => {
  it("ordinary users cannot change settings, cities or the audit log", async () => {
    await alice.client.from("site_settings").update({ value: 999 }).eq("key", "listing_expiry_days");
    const { data } = await service.from("site_settings").select("value").eq("key", "listing_expiry_days").single();
    expect(data!.value).toBe(30);

    const city = await alice.client.from("cities").insert({ slug: "fake-city", name_ar: "مدينة", name_en: "Fake" });
    expect(city.error).not.toBeNull();

    expect((await alice.client.from("admin_audit_logs").select("id")).data).toHaveLength(0);
  });

  it("private settings are hidden from the public", async () => {
    const { data } = await anon.from("site_settings").select("key").eq("key", "max_reports_per_24h");
    expect(data).toHaveLength(0);
  });

  it("admins can change settings and the change is audited", async () => {
    const change = await admin.client.from("site_settings").update({ value: 31 }).eq("key", "listing_expiry_days");
    expect(change.error).toBeNull();
    const revert = await admin.client.from("site_settings").update({ value: 30 }).eq("key", "listing_expiry_days");
    expect(revert.error).toBeNull();
    const log = await admin.client
      .from("admin_audit_logs")
      .select("id")
      .eq("entity_type", "site_settings")
      .eq("entity_id", "listing_expiry_days")
      .eq("actor_id", admin.id);
    expect(log.data!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("stage 4 rules", () => {
  it("adding a photo to a published listing sends it back for review", async () => {
    // Carol is temporarily reactivated for this test (other tests need her suspended).
    await service.from("profiles").update({ status: "active" }).eq("id", carol.id);
    const listing = await createListing(carol, "Carol published flat");
    await makeSubmittable(carol, listing.id);
    await service
      .from("listings")
      .update({ status: "published", published_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86_400_000).toISOString() })
      .eq("id", listing.id);

    const add = await carol.client.from("listing_images").insert({
      listing_id: listing.id,
      storage_path: `${carol.id}/${listing.id}/${randomUUID()}.webp`,
    });
    expect(add.error).toBeNull();
    expect(await statusOf(listing.id)).toBe("pending_approval");
    await service.from("profiles").update({ status: "suspended" }).eq("id", carol.id);
  });

  it("thumbnails must be in the owner's own folder", async () => {
    const draft = await createListing(alice, "Alice thumbnail test");
    const bad = await alice.client.from("listing_images").insert({
      listing_id: draft.id,
      storage_path: `${alice.id}/${draft.id}/${randomUUID()}.webp`,
      thumb_path: `${bob.id}/${draft.id}/${randomUUID()}.webp`,
    });
    expect(bad.error?.code).toBe("42501");
    await service.from("listings").delete().eq("id", draft.id);
  });

  it("requesting account deletion withdraws the user's live listings", async () => {
    const extra = await createUser("leaver");
    const listing = await createListing(extra, "Leaver listing for deletion test");
    await makeSubmittable(extra, listing.id);
    await extra.client.rpc("change_listing_status", { p_listing_id: listing.id, p_new_status: "pending_approval" });

    const { error } = await extra.client.rpc("request_account_deletion");
    expect(error).toBeNull();
    expect(await statusOf(listing.id)).toBe("withdrawn");
    const { data } = await service.from("profiles").select("status").eq("id", extra.id).single();
    expect(data!.status).toBe("deletion_requested");

    // A user awaiting deletion can no longer create listings.
    const blocked = await extra.client.from("listings").insert(listingInput("Should be blocked listing"));
    expect(blocked.error).not.toBeNull();

    await service.from("listings").delete().eq("seller_id", extra.id);
    await service.auth.admin.deleteUser(extra.id);
  });
});

describe("stage 5: admin functions", () => {
  it("are refused for visitors and ordinary users", async () => {
    for (const client of [anon, alice.client]) {
      expect((await client.rpc("admin_overview")).error).not.toBeNull();
      expect((await client.rpc("admin_search_users", { p_query: "test" })).error).not.toBeNull();
      expect((await client.rpc("admin_set_listing_expiry", { p_listing_id: 1, p_expires_at: new Date().toISOString() })).error).not.toBeNull();
      expect((await client.rpc("admin_anonymize_user", { p_user_id: bob.id, p_reason: "x" })).error).not.toBeNull();
      expect(
        (await client.rpc("record_admin_action", { p_actor: alice.id, p_action: "x", p_entity_type: "x", p_entity_id: "x", p_details: {} })).error,
      ).not.toBeNull();
    }
  });

  it("let admins see the overview and search users (with emails)", async () => {
    const overview = await admin.client.rpc("admin_overview");
    expect(overview.error).toBeNull();
    expect(overview.data).toHaveProperty("live_listings");

    const search = await admin.client.rpc("admin_search_users", { p_query: alice.email });
    expect(search.error).toBeNull();
    expect(search.data?.[0]?.email).toBe(alice.email);
  });

  it("contact messages are visible to admins only", async () => {
    const { data: msg } = await service
      .from("contact_messages")
      .insert({ topic: "general", message: "Automated test message" })
      .select("id")
      .single();
    expect((await alice.client.from("contact_messages").select("id").eq("id", msg!.id)).data ?? []).toHaveLength(0);
    expect((await anon.from("contact_messages").select("id").eq("id", msg!.id)).data ?? []).toHaveLength(0);
    expect((await admin.client.from("contact_messages").select("id").eq("id", msg!.id)).data).toHaveLength(1);

    const resolve = await admin.client.from("contact_messages").update({ status: "resolved" }).eq("id", msg!.id).select("resolved_by");
    expect(resolve.data?.[0]?.resolved_by).toBe(admin.id);
    await service.from("contact_messages").delete().eq("id", msg!.id);
  });

  it("admins can end or extend a listing's publication, and it is audited", async () => {
    const { data: live } = await service.from("listings").select("id").eq("seller_id", bob.id).eq("status", "published").limit(1).single();
    const end = await admin.client.rpc("admin_set_listing_expiry", {
      p_listing_id: live!.id,
      p_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(end.data).toBe("expired");
    const extend = await admin.client.rpc("admin_set_listing_expiry", {
      p_listing_id: live!.id,
      p_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    expect(extend.data).toBe("published");
    const log = await admin.client
      .from("admin_audit_logs")
      .select("id")
      .eq("action", "listing_expiry_change")
      .eq("entity_id", String(live!.id));
    expect(log.data!.length).toBeGreaterThanOrEqual(2);
  });

  it("completing a deletion removes personal data but keeps the listing record", async () => {
    const leaver = await createUser("anon-me");
    const listing = await createListing(leaver, "Listing of a deleted user");
    await makeSubmittable(leaver, listing.id);
    await service.from("profiles").update({ phone: "+962791111111" }).eq("id", leaver.id);

    const done = await admin.client.rpc("admin_anonymize_user", { p_user_id: leaver.id, p_reason: "User request" });
    expect(done.error).toBeNull();
    const { data: profile } = await service.from("profiles").select("display_name, phone, status").eq("id", leaver.id).single();
    expect(profile).toEqual({ display_name: "مستخدم محذوف", phone: null, status: "deleted" });
    expect((await service.from("listing_contacts").select("listing_id").eq("listing_id", listing.id)).data).toHaveLength(0);
    expect((await service.from("listings").select("id").eq("id", listing.id)).data).toHaveLength(1);

    const self = await admin.client.rpc("admin_anonymize_user", { p_user_id: admin.id, p_reason: "x" });
    expect(self.error?.message).toContain("cannot_change_own_status");

    await service.from("listings").delete().eq("seller_id", leaver.id);
    await service.auth.admin.deleteUser(leaver.id);
  });
});

describe("stage 7: location privacy and notifications", () => {
  it("only the owner and admins can read the exact map pin; others get a rounded position", async () => {
    const listing = await createListing(alice, "Alice pinned flat");
    await service.from("listings").update({ latitude: 31.951234, longitude: 35.873456 }).eq("id", listing.id);

    const exact = await bob.client.from("listings").select("latitude").eq("id", listing.id);
    expect(exact.error?.code).toBe("42501");
    const anonExact = await anon.from("listings").select("longitude").limit(1);
    expect(anonExact.error?.code).toBe("42501");

    const own = await alice.client.rpc("get_listing_location", { p_listing_id: listing.id });
    expect(own.data?.[0]).toEqual({ latitude: 31.951234, longitude: 35.873456 });
    const other = await bob.client.rpc("get_listing_location", { p_listing_id: listing.id });
    expect(other.data ?? []).toHaveLength(0);
    const asAdmin = await admin.client.rpc("get_listing_location", { p_listing_id: listing.id });
    expect(asAdmin.data).toHaveLength(1);

    const approx = await alice.client.from("listings").select("approx_latitude, approx_longitude").eq("id", listing.id).single();
    expect(approx.data).toEqual({ approx_latitude: 31.95, approx_longitude: 35.87 });
    await service.from("listings").delete().eq("id", listing.id);
  });

  it("admins are notified of new submissions; sellers of expiry", async () => {
    const { data: live } = await service.from("listings").select("id, seller_id").eq("seller_id", bob.id).eq("status", "published").limit(1).single();
    await service.from("listings").update({ expires_at: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", live!.id);
    await service.rpc("notify_expiring_listings");
    const soon = await bob.client.from("notifications").select("type").eq("type", "listing_expiring").eq("data->>listing_id", String(live!.id));
    expect(soon.data).toHaveLength(1);
    await service.rpc("notify_expiring_listings"); // no duplicates
    expect((await bob.client.from("notifications").select("id").eq("type", "listing_expiring").eq("data->>listing_id", String(live!.id))).data).toHaveLength(1);

    await service.from("listings").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", live!.id);
    await service.rpc("expire_listings");
    expect((await bob.client.from("notifications").select("id").eq("type", "listing_expired").eq("data->>listing_id", String(live!.id))).data).toHaveLength(1);

    const submitted = await admin.client.from("notifications").select("type").eq("type", "listing_submitted");
    expect(submitted.data!.length).toBeGreaterThan(0);
  });

  it("users can only mark their own notifications as read, and can't create any", async () => {
    const forged = await alice.client.from("notifications").insert({ user_id: alice.id, type: "fake", data: {} });
    expect(forged.error).not.toBeNull();
    const { data: bobs } = await service.from("notifications").select("id").eq("user_id", bob.id).limit(1);
    await alice.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", bobs![0].id);
    const check = await service.from("notifications").select("read_at").eq("id", bobs![0].id).single();
    expect(check.data!.read_at).toBeNull();
  });
});

describe("rate limiter (used by 'show phone number')", () => {
  it("cannot be called or read by visitors or users", async () => {
    expect((await anon.rpc("check_rate_limit", { p_key: "x:test", p_max: 1, p_window_seconds: 60 })).error).not.toBeNull();
    expect((await alice.client.rpc("check_rate_limit", { p_key: "x:test", p_max: 1, p_window_seconds: 60 })).error).not.toBeNull();
    expect((await alice.client.from("rate_limits").select("key")).data ?? []).toHaveLength(0);
  });

  it("allows up to the limit, then blocks", async () => {
    const key = `test:${runId}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data, error } = await service.rpc("check_rate_limit", { p_key: key, p_max: 3, p_window_seconds: 3600 });
      expect(error).toBeNull();
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, false]);
    await service.from("rate_limits").delete().eq("key", key);
  });
});

describe("photo storage", () => {
  // 1x1 transparent PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  let listingId: number;
  let path: string;

  beforeAll(async () => {
    const { data } = await service.from("listings").select("id").eq("seller_id", alice.id).eq("status", "draft").limit(1).single();
    listingId = data!.id;
    path = `${alice.id}/${listingId}/${randomUUID()}.png`;
  });

  it("owners can upload photos to their own listing folder", async () => {
    const { error } = await alice.client.storage.from("listing-photos").upload(path, png, { contentType: "image/png" });
    expect(error).toBeNull();
    uploadedFiles.push(path);
  });

  it("users cannot upload into another user's folder or listing", async () => {
    const other = `${alice.id}/${listingId}/${randomUUID()}.png`;
    const { error } = await bob.client.storage.from("listing-photos").upload(other, png, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("non-image files are rejected", async () => {
    const bad = `${alice.id}/${listingId}/${randomUUID()}.png`;
    const { error } = await alice.client.storage
      .from("listing-photos")
      .upload(bad, Buffer.from("not an image"), { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });

  it("nobody can upload directly to the public bucket", async () => {
    const { error } = await alice.client.storage
      .from("listing-photos-public")
      .upload(`${alice.id}/${listingId}/${randomUUID()}.png`, png, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("private photos are not downloadable by visitors or other users", async () => {
    expect((await anon.storage.from("listing-photos").download(path)).error).not.toBeNull();
    expect((await bob.client.storage.from("listing-photos").download(path)).error).not.toBeNull();
    expect((await alice.client.storage.from("listing-photos").download(path)).error).toBeNull();
    expect((await admin.client.storage.from("listing-photos").download(path)).error).toBeNull();
  });
});

describe("floor and property type rules", () => {
  async function typeId(slug: string) {
    const { data } = await service.from("property_types").select("id").eq("slug", slug).single();
    return data!.id;
  }

  it("rejects a deal the property type doesn't allow (residential land for rent)", async () => {
    const { error } = await alice.client
      .from("listings")
      .insert({ ...listingInput("Land offered for rent"), deal_type: "rent", property_type_id: await typeId("residential-land") });
    expect(error?.message).toContain("deal_not_allowed_for_type");
  });

  it("rejects a floor on a type without floors (land)", async () => {
    const { error } = await alice.client
      .from("listings")
      .insert({ ...listingInput("Land with a floor"), property_type_id: await typeId("residential-land"), floor_level: "ground" });
    expect(error?.message).toContain("floor_not_allowed_for_type");
  });

  it("rejects details that don't apply to the type (bathrooms or bedrooms on land, furnished on a shop)", async () => {
    const land = await typeId("residential-land");
    const shop = await typeId("shop");
    const bathrooms = await service.from("listings").insert({ ...listingInput("Land with bathrooms"), seller_id: alice.id, property_type_id: land, bedrooms: null });
    expect(bathrooms.error?.message).toContain("bathrooms_not_allowed_for_type");
    const bedrooms = await service.from("listings").insert({ ...listingInput("Land with bedrooms"), seller_id: alice.id, property_type_id: land, bathrooms: null });
    expect(bedrooms.error?.message).toContain("bedrooms_not_allowed_for_type");
    const furnished = await service
      .from("listings")
      .insert({ ...listingInput("Furnished shop"), seller_id: alice.id, property_type_id: shop, bedrooms: null, details: { furnished: true } });
    expect(furnished.error?.message).toContain("furnished_not_allowed_for_type");
  });

  it("offers 'top floor' and 'top floor with roof' as separate choices", async () => {
    const { data, error } = await service
      .from("listings")
      .insert({ ...listingInput("Penthouse with roof"), seller_id: alice.id, floor_level: "last_with_roof" })
      .select("floor_level")
      .single();
    expect(error).toBeNull();
    expect(data!.floor_level).toBe("last_with_roof");
  });

  it("saves a floor on an apartment, and visitors can filter by it once published", async () => {
    const { data, error } = await service
      .from("listings")
      .insert({ ...listingInput("Ground floor flat"), seller_id: alice.id, floor_level: "ground" })
      .select("id, floor_level")
      .single();
    expect(error).toBeNull();
    expect(data!.floor_level).toBe("ground");

    await service.from("listings").update({ status: "published", published_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", data!.id);
    const found = await anon.from("listings").select("id").eq("floor_level", "ground").eq("id", data!.id);
    expect(found.data).toHaveLength(1);
    const other = await anon.from("listings").select("id").eq("floor_level", "last").eq("id", data!.id);
    expect(other.data).toHaveLength(0);

    const facets = await anon.rpc("listing_area_facets");
    expect(facets.error).toBeNull();
    expect(facets.data!.some((f: { city_id: number; neighborhood_id: number | null }) => f.city_id === cityId && f.neighborhood_id === neighborhoodId)).toBe(true);
  });

  it("changing the floor of a published listing sends it back for review", async () => {
    // Created by the service key: the test users have used up their daily new-listing limit by now.
    const { data, error: insertError } = await service
      .from("listings")
      .insert({ ...listingInput("Flat to re-floor"), seller_id: bob.id, floor_level: "first" })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    await service.from("listings").update({ status: "published", published_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", data!.id);
    const { error } = await bob.client.from("listings").update({ floor_level: "last" }).eq("id", data!.id);
    expect(error).toBeNull();
    expect(await statusOf(data!.id)).toBe("pending_approval");
  });
});
