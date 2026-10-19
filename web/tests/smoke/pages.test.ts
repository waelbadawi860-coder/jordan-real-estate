/**
 * Smoke test for logged-in pages, against the running development server.
 *   1. Start the site:   npm run dev
 *   2. In another tab:   npm run test:smoke
 * Creates a temporary user and draft listing in the DEVELOPMENT database,
 * loads each private page as that user, then deletes everything.
 */
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const email = `smoke-${randomUUID().slice(0, 8)}@example.com`;
const password = `${randomUUID()}Aa1`;
let userId = "";
let listingId = 0;
let cookie = "";
let accessToken = "";
const title = `اختبار الصفحات ${randomUUID().slice(0, 6)}`;

function get(path: string, withCookie = true) {
  return fetch(`${base}${path}`, { redirect: "manual", headers: withCookie ? { cookie } : {} });
}

beforeAll(async () => {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Smoke Test" },
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  // Log in exactly like the website does, capturing its session cookies.
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(url, publishableKey, {
    cookies: { getAll: () => jar, setAll: (items) => items.forEach((c) => jar.push({ name: c.name, value: c.value })) },
  });
  const signIn = await ssr.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  accessToken = signIn.data.session!.access_token;
  cookie = jar.map((c) => `${c.name}=${c.value}`).join("; ");

  const [{ data: city }, { data: type }] = await Promise.all([
    service.from("cities").select("id").eq("slug", "amman").single(),
    service.from("property_types").select("id").eq("slug", "apartment").single(),
  ]);
  const { data: listing, error } = await service
    .from("listings")
    .insert({ seller_id: userId, title, deal_type: "sale", property_type_id: type!.id, city_id: city!.id, price: 99000 })
    .select("id")
    .single();
  if (error) throw error;
  listingId = listing.id;
  await service.from("listing_contacts").insert({ listing_id: listingId, phone: "+962791112233" });
}, 60_000);

afterAll(async () => {
  if (listingId) await service.from("listings").delete().eq("id", listingId);
  if (userId) await service.auth.admin.deleteUser(userId);
});

describe("logged-in pages", () => {
  it("send visitors without a session to the login page", async () => {
    const res = await get("/my/listings", false);
    expect([303, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("show the seller's own listings", async () => {
    const res = await get("/my/listings");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(title);
  });

  it("preview a draft with its private contact number", async () => {
    const res = await get(`/my/listings/${listingId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(title);
    expect(html).toContain("079 111 2233");
  });

  it("open the edit form with saved values", async () => {
    const res = await get(`/en/my/listings/${listingId}/edit`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(title);
    expect(html).toContain("0791112233");
  });

  it("show the account page with the user's email", async () => {
    const res = await get("/my/account");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(email);
  });

  it("show the add-property form and favourites", async () => {
    expect((await get("/post")).status).toBe(200);
    expect((await get("/my/favourites")).status).toBe(200);
  });

  it("redirect logged-in users away from the login page", async () => {
    const res = await get("/login");
    expect([303, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/my/listings");
  });

  it("accept photo uploads exactly the way the photo uploader sends them", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    const path = `${userId}/${listingId}/${randomUUID()}.png`;
    const res = await fetch(`${url}/storage/v1/object/listing-photos/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: publishableKey,
        "Content-Type": "image/png",
        "x-upsert": "false",
      },
      body: png,
    });
    expect(res.status).toBe(200);
    await service.storage.from("listing-photos").remove([path]);

    // ...and refuse uploads into someone else's listing folder.
    const other = await fetch(`${url}/storage/v1/object/listing-photos/${userId}/100017/${randomUUID()}.png`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, apikey: publishableKey, "Content-Type": "image/png" },
      body: png,
    });
    expect(other.status).toBeGreaterThanOrEqual(400);
  });

  it("never show another seller's listing", async () => {
    const res = await get(`/my/listings/100017`); // a demo listing owned by someone else
    expect(res.status).toBe(404);
  });
});
