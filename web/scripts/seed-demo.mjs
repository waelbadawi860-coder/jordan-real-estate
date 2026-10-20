// Demo listings for the DEVELOPMENT database, so pages can be tested.
//   Add:     npm run demo:add
//   Remove:  npm run demo:remove
// Every demo listing title starts with "[تجريبي]" (demo) and belongs to one
// demo account. Never run this against the production project.
import { randomUUID } from "node:crypto";
import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}

// Safety: demo data is only ever written to the development database.
if (process.env.SITE_STAGE === "live" || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SITE_URL ?? "")) {
  console.error("Refusing to run: demo data is for the development database only (NEXT_PUBLIC_SITE_URL must be http://localhost…).");
  process.exit(1);
}

const DEMO_EMAIL = "demo-seller@example.com";
const PUBLIC_BUCKET = "listing-photos-public";
const sb = createClient(url, secret, { auth: { persistSession: false } });

async function findDemoUser() {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === DEMO_EMAIL);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

async function removeDemo() {
  const user = await findDemoUser();
  if (!user) {
    console.log("No demo data found.");
    return;
  }
  const { data: listings } = await sb.from("listings").select("id").eq("seller_id", user.id);
  for (const { id } of listings ?? []) {
    const { data: files } = await sb.storage.from(PUBLIC_BUCKET).list(`${user.id}/${id}`);
    if (files?.length) await sb.storage.from(PUBLIC_BUCKET).remove(files.map((f) => `${user.id}/${id}/${f.name}`));
  }
  await sb.from("listings").delete().eq("seller_id", user.id);
  const { error } = await sb.auth.admin.deleteUser(user.id);
  if (error) throw error;
  console.log(`Removed ${listings?.length ?? 0} demo listings and the demo account.`);
}

// --- Simple generated pictures (PNG) -----------------------------------------
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function makePicture(seed, width = 960, height = 720) {
  const hue = (seed * 47) % 360;
  const sky = hslToRgb(hue, 0.45, 0.78);
  const wall = hslToRgb((hue + 30) % 360, 0.25, 0.86);
  const ground = [196, 176, 140];
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  const bLeft = width * (0.25 + (seed % 3) * 0.05);
  const bRight = width * (0.75 - (seed % 2) * 0.05);
  const bTop = height * (0.25 + (seed % 4) * 0.04);
  const groundY = height * 0.78;
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < width; x++) {
      let c;
      if (y >= groundY) c = ground;
      else if (x > bLeft && x < bRight && y > bTop) {
        const wx = (x - bLeft) % 70;
        const wy = (y - bTop) % 80;
        c = wx > 20 && wx < 50 && wy > 20 && wy < 55 ? [70, 110, 140] : wall;
      } else {
        const t = y / groundY;
        c = sky.map((v) => Math.round(v * (1 - t * 0.25)));
      }
      const i = y * row + 1 + x * 3;
      raw[i] = c[0];
      raw[i + 1] = c[1];
      raw[i + 2] = c[2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return {
    width,
    height,
    bytes: Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", header),
      pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  };
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

// --- Demo listings ------------------------------------------------------------
const DEMO = [
  ["apartment", "sale", "abdoun", "شقة طابق ثالث بإطلالة في عبدون", 185000, 180, 3, 3],
  ["apartment", "rent", "khalda", "شقة مفروشة للإيجار في خلدا", 650, 140, 2, 2, "monthly"],
  ["villa", "sale", "dabouq", "فيلا مستقلة مع حديقة في دابوق", 720000, 550, 5, 6],
  ["apartment", "sale", "sweifieh", "شقة تسوية مع ترس في الصويفية", 98000, 120, 2, 2],
  ["shop", "rent", "jabal-amman", "محل تجاري على شارع رئيسي في جبل عمّان", 9000, 60, null, 1, "yearly"],
  ["apartment", "rent", "tla-al-ali", "شقة عائلية للإيجار السنوي في تلاع العلي", 5400, 160, 3, 2, "yearly"],
  ["office", "rent", "shmeisani", "مكتب إداري جاهز في الشميساني", 750, 95, null, 1, "monthly"],
  ["residential-land", "sale", "marj-al-hamam", "أرض سكنية مستوية في مرج الحمام", 120000, 750, null, null],
  ["apartment", "sale", "jubeiha", "شقة جديدة قرب الجامعة الأردنية في الجبيهة", 76000, 130, 3, 2],
  ["house", "sale", "jabal-al-hussein", "بيت مستقل طابقين في جبل الحسين", 210000, 260, 4, 3],
  ["building", "sale", "shafa-badran", "عمارة سكنية 4 طوابق في شفا بدران", 650000, 1100, null, null],
  ["apartment", "rent", "rabieh", "شقة أرضية مع حديقة للإيجار في الرابية", 800, 175, 3, 3, "monthly"],
  ["commercial-land", "sale", "tabarbour", "أرض تجارية على شارعين في طبربور", 350000, 1000, null, null],
  ["villa", "rent", "um-al-summaq", "فيلا للإيجار مع مسبح في أم السماق", 30000, 480, 5, 5, "yearly"],
];

async function addDemo() {
  if (await findDemoUser()) {
    console.log("Demo data already exists. Run npm run demo:remove first to recreate it.");
    return;
  }
  const { data: created, error: userError } = await sb.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: `${randomUUID()}Aa1`,
    email_confirm: true,
    user_metadata: { display_name: "حساب تجريبي" },
  });
  if (userError) throw userError;
  const sellerId = created.user.id;

  const [{ data: types }, { data: hoods }] = await Promise.all([
    sb.from("property_types").select("id, slug, has_bedrooms"),
    sb.from("neighborhoods").select("id, city_id, slug"),
  ]);

  let count = 0;
  for (const [index, [typeSlug, deal, hoodSlug, title, price, area, beds, baths, period]] of DEMO.entries()) {
    const type = types.find((t) => t.slug === typeSlug);
    const hood = hoods.find((h) => h.slug === hoodSlug);
    const { data: listing, error } = await sb
      .from("listings")
      .insert({
        seller_id: sellerId,
        title: `[تجريبي] ${title}`,
        description:
          "هذا إعلان تجريبي لاختبار الموقع فقط، وليس عقاراً حقيقياً.\nThis is a demo listing for testing only — not a real property.",
        deal_type: deal,
        property_type_id: type.id,
        city_id: hood.city_id,
        neighborhood_id: hood.id,
        price,
        area_sqm: area,
        bedrooms: beds,
        bathrooms: baths,
        details: period ? { rent_period: period } : {},
        poster_type: index % 4 === 0 ? "agent" : "owner",
      })
      .select("id")
      .single();
    if (error) throw error;

    // Unassigned-looking landline so nobody real is contacted by mistake.
    await sb.from("listing_contacts").insert({ listing_id: listing.id, phone: "+96260000000" });

    for (let n = 0; n < 2; n++) {
      const picture = makePicture(index * 2 + n);
      const path = `${sellerId}/${listing.id}/${randomUUID()}.png`;
      const upload = await sb.storage.from(PUBLIC_BUCKET).upload(path, picture.bytes, { contentType: "image/png" });
      if (upload.error) throw upload.error;
      await sb.from("listing_images").insert({
        listing_id: listing.id,
        storage_path: path,
        position: n,
        width: picture.width,
        height: picture.height,
      });
    }
    await sb.from("listing_images").update({ public_copied_at: new Date().toISOString() }).eq("listing_id", listing.id);

    const publishedAt = new Date(Date.now() - index * 3_600_000);
    const { error: publishError } = await sb
      .from("listings")
      .update({
        status: "published",
        published_at: publishedAt.toISOString(),
        expires_at: new Date(publishedAt.getTime() + 30 * 86_400_000).toISOString(),
      })
      .eq("id", listing.id);
    if (publishError) throw publishError;
    count++;
  }
  console.log(`Added ${count} published demo listings.`);
}

if (process.argv[2] === "--remove") await removeDemo();
else await addDemo();
