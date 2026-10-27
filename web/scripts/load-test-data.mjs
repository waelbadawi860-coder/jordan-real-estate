// Speed-test data for the DEVELOPMENT database: many published listings with
// realistic photos, to measure the site at a larger size.
//   Add:     node --env-file=.env.local scripts/load-test-data.mjs 1000
//   Remove:  node --env-file=.env.local scripts/load-test-data.mjs --remove
// Every listing title starts with "[اختبار سرعة]" and belongs to one test
// account. A small set of model photos is uploaded once, then copied on the
// server into each listing's own folder (2 photos + list thumbnails per ad,
// ≈150–250 KB each, like real uploads). Never run on production.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret || process.env.SITE_STAGE === "live" || !/bglfiabquferwviaysqd/.test(url)) {
  console.error("Refusing to run: speed-test data is for the development database (aqar-dev) only.");
  process.exit(1);
}

const EMAIL = "perf-seller@example.com";
const BUCKET = "listing-photos-public";
const POOL = 20;
const PHOTOS = 2;
const sb = createClient(url, secret, { auth: { persistSession: false } });

async function findUser() {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === EMAIL);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

async function remove() {
  const user = await findUser();
  if (!user) return console.log("No speed-test data found.");
  const { data: pool } = await sb.storage.from(BUCKET).list(`${user.id}/pool`, { limit: 1000 });
  if (pool?.length) await sb.storage.from(BUCKET).remove(pool.map((f) => `${user.id}/pool/${f.name}`));
  const { data: images } = await sb.from("listing_images").select("storage_path, thumb_path, listings!inner(seller_id)").eq("listings.seller_id", user.id).limit(100000);
  const paths = (images ?? []).flatMap((i) => [i.storage_path, i.thumb_path].filter(Boolean));
  for (let i = 0; i < paths.length; i += 500) await sb.storage.from(BUCKET).remove(paths.slice(i, i + 500));
  const { count } = await sb.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id);
  await sb.from("listings").delete().eq("seller_id", user.id);
  await sb.auth.admin.deleteUser(user.id);
  console.log(`Removed ${count ?? 0} speed-test listings and the test account.`);
}

/** A photo-like picture (gradients and noise) so the file sizes are realistic. */
async function photo(seed, width, height, quality) {
  const raw = Buffer.alloc(width * height * 3);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const n = rnd() * 20;
      raw[i] = Math.min(255, 90 + ((x * 120) / width) + n + (seed % 7) * 10);
      raw[i + 1] = Math.min(255, 110 + ((y * 100) / height) + n);
      raw[i + 2] = Math.min(255, 130 + (((x + y) * 60) / (width + height)) + n);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).webp({ quality }).toBuffer();
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function add(total) {
  let user = await findUser();
  if (!user) {
    const created = await sb.auth.admin.createUser({ email: EMAIL, password: `${randomUUID()}Aa1!`, email_confirm: true, user_metadata: { display_name: "حساب اختبار السرعة" } });
    if (created.error) throw created.error;
    user = created.data.user;
  }

  // Photo pool: full size (≈1600px, like the site's uploads) and a list thumbnail.
  const pool = [];
  await inBatches([...Array(POOL).keys()], 5, async (n) => {
    const full = `${user.id}/pool/${n}.webp`;
    const thumb = `${user.id}/pool/${n}-thumb.webp`;
    for (const [path, bytes] of [[full, await photo(n, 1600, 1200, 80)], [thumb, await photo(n, 400, 300, 75)]]) {
      const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true });
      if (up.error) throw up.error;
    }
    pool[n] = { full, thumb };
  });
  console.log(`Uploaded ${POOL * 2} pool photos.`);

  const [{ data: types }, { data: hoods }] = await Promise.all([
    sb.from("property_types").select("id, slug, has_bedrooms, has_bathrooms, has_floor, has_floors_count, has_furnished, allowed_deals"),
    sb.from("neighborhoods").select("id, city_id, cities(slug)").eq("is_active", true),
  ]);
  const amman = hoods.filter((h) => h.cities.slug === "amman");
  const others = hoods.filter((h) => h.cities.slug !== "amman");
  const typeMix = ["apartment", "apartment", "apartment", "apartment", "apartment", "villa", "house", "residential-land", "office", "shop", "building"];
  const floors = ["basement", "ground", "first", "second", "third", "fourth", "fifth_plus", "last"];

  let made = 0;
  const ids = [...Array(total).keys()];
  await inBatches(ids, 10, async (i) => {
    const type = types.find((t) => t.slug === typeMix[i % typeMix.length]) ?? types[0];
    const deal = type.allowed_deals[i % type.allowed_deals.length];
    const hood = i % 10 < 6 ? amman[i % amman.length] : others[i % others.length];
    const price = deal === "rent" ? 250 + (i % 30) * 25 : 40_000 + (i % 50) * 6_000;
    const { data: listing, error } = await sb
      .from("listings")
      .insert({
        seller_id: user.id,
        title: `[اختبار سرعة] ${type.slug} ${i + 1}`,
        description: "إعلان لاختبار سرعة الموقع فقط، وسيُحذف بعد الاختبار.\nSpeed-test listing, will be removed after the test.",
        deal_type: deal,
        property_type_id: type.id,
        city_id: hood.city_id,
        neighborhood_id: hood.id,
        price,
        area_sqm: 80 + (i % 40) * 10,
        bedrooms: type.has_bedrooms ? 1 + (i % 5) : null,
        bathrooms: type.has_bathrooms ? 1 + (i % 3) : null,
        floor_level: type.has_floor ? floors[i % floors.length] : null,
        floors_count: type.has_floors_count ? 1 + (i % 4) : null,
        details: { ...(deal === "rent" ? { rent_period: "monthly" } : {}), ...(type.has_furnished ? { furnished: i % 3 === 0 ? "yes" : "no" } : {}) },
        poster_type: i % 3 === 0 ? "agent" : "owner",
      })
      .select("id")
      .single();
    if (error) throw error;
    await sb.from("listing_contacts").insert({ listing_id: listing.id, phone: "+96260000000" });
    const images = [];
    for (let n = 0; n < PHOTOS; n++) {
      const p = pool[(i * PHOTOS + n) % POOL];
      const full = `${user.id}/${listing.id}/${randomUUID()}.webp`;
      const thumb = `${user.id}/${listing.id}/${randomUUID()}.webp`;
      for (const [from, to] of [[p.full, full], [p.thumb, thumb]]) {
        const copy = await sb.storage.from(BUCKET).copy(from, to);
        if (copy.error) throw copy.error;
      }
      images.push({ listing_id: listing.id, storage_path: full, thumb_path: thumb, position: n, width: 1600, height: 1200, public_copied_at: new Date().toISOString() });
    }
    const img = await sb.from("listing_images").insert(images);
    if (img.error) throw img.error;
    const publishedAt = new Date(Date.now() - i * 600_000);
    const pub = await sb
      .from("listings")
      .update({ status: "published", published_at: publishedAt.toISOString(), expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() })
      .eq("id", listing.id);
    if (pub.error) throw pub.error;
    if (++made % 100 === 0) console.log(`${made} listings…`);
  });
  console.log(`Added ${made} published speed-test listings (${PHOTOS} photos + thumbnails each).`);
}

if (process.argv[2] === "--remove") await remove();
else await add(Number(process.argv[2] ?? 1000));
