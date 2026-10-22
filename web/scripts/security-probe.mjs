// Black-box security probe against the DEVELOPMENT database and a site URL
// (staging by default). It acts as an anonymous visitor and as an ordinary
// signed-in user and tries things that must be refused. Prints PASS/FAIL.
//   node --env-file=.env.local scripts/security-probe.mjs [https://aqar-staging.vercel.app]
// Creates one temporary user and deletes it at the end.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const site = process.argv[2] ?? "https://aqar-staging.vercel.app";
if (!/bglfiabquferwviaysqd/.test(url ?? "")) {
  console.error("Development database only.");
  process.exit(1);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secret, opts);
const anon = createClient(url, anonKey, opts);

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
const refused = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0) || r.data === null;

// --- temporary ordinary user -------------------------------------------------
const email = `probe-${randomUUID().slice(0, 8)}@example.com`;
const password = `${randomUUID()}Aa1!`;
const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Probe" } });
if (created.error) throw created.error;
const me = created.data.user.id;
const user = createClient(url, anonKey, opts);
await user.auth.signInWithPassword({ email, password });

try {
  const { data: someListing } = await service.from("listings").select("id, seller_id").eq("status", "published").neq("seller_id", me).limit(1).single();
  const { data: otherUser } = await service.from("profiles").select("id").neq("id", me).limit(1).single();

  // 1. Private data must not be readable by visitors or other users.
  for (const [table, cols] of [
    ["profiles", "phone"],
    ["listing_contacts", "phone"],
    ["listing_declarations", "id"],
    ["admin_audit_logs", "id"],
    ["notifications", "id"],
    ["office_verifications", "documents"],
    ["office_plan_history", "id"],
    ["listing_promotions", "id"],
    ["blocked_identifiers", "value"],
    ["contact_messages", "message"],
    ["rate_limits", "*"],
    ["user_consents", "*"],
    ["listing_versions", "data"],
    ["listing_risk", "flags"],
    ["listing_reports", "details"],
    ["user_reports", "*"],
    ["commission_records", "*"],
    ["payment_records", "*"],
  ]) {
    for (const [who, client] of [["visitor", anon], ["other user", user]]) {
      // The signed-in user may read their own profile; look at everyone else's.
      let q = client.from(table).select(cols).limit(5);
      if (table === "profiles" && client === user) q = q.neq("id", me);
      const r = await q;
      check(`${who} cannot read ${table}.${cols}`, refused(r), r.error ? "" : `got ${r.data?.length} rows`);
    }
  }
  // Map positions are public by owner decision (2026-10-22), but only on published listings.
  const draftPins = await anon.from("listings").select("latitude").neq("status", "published").limit(1);
  check("visitor cannot read positions of unpublished listings", refused(draftPins));
  const hidden = await anon.from("listings").select("id").neq("status", "published").limit(1);
  check("visitor sees only published listings", refused(hidden));
  const privateSettings = await anon.from("site_settings").select("key").eq("is_public", false);
  check("visitor cannot read private settings", refused(privateSettings), privateSettings.data?.map((s) => s.key).join(","));

  // 2. Privilege escalation and protected fields.
  await user.from("profiles").update({ role: "admin" }).eq("id", me);
  await user.from("profiles").update({ status: "active", role: "admin" }).eq("id", me);
  const role = await service.from("profiles").select("role").eq("id", me).single();
  check("user cannot make themselves admin", role.data.role === "user");
  const steal = await user.from("listings").update({ title: "hacked" }).eq("id", someListing.id).select("id");
  check("user cannot edit someone else's listing", refused(steal));
  const sneaky = await user.from("listings").insert({ title: "Probe flat for testing", description: "Probe listing for the security test.", deal_type: "sale", property_type_id: 1, city_id: 1, price: 1000, status: "published", featured_until: "2099-01-01" }).select("id, status");
  check("user cannot create a published or featured listing", !!sneaky.error || sneaky.data?.[0]?.status === "draft", sneaky.error?.message ?? sneaky.data?.[0]?.status);
  const { data: apt } = await service.from("property_types").select("id").eq("slug", "apartment").single();
  const own = await user.from("listings").insert({ title: "Probe flat for testing", description: "Probe listing for the security test.", deal_type: "sale", property_type_id: apt.id, city_id: 1, price: 1000 }).select("id, status");
  check("user can create a normal draft (control)", !own.error && own.data?.[0]?.status === "draft", own.error?.message);
  if (own.data?.[0]) {
    const lid = own.data[0].id;
    const pub = await user.from("listings").update({ status: "published" }).eq("id", lid).select("status");
    check("user cannot publish by writing the status", !!pub.error || pub.data?.[0]?.status !== "published");
    const feat = await user.from("listings").update({ featured_until: "2099-01-01", bumped_at: "2099-01-01" }).eq("id", lid);
    check("user cannot feature or bump their own listing", !!feat.error);
    const skip = await user.rpc("change_listing_status", { p_listing_id: lid, p_new_status: "published" });
    check("user cannot skip review through the status function", !!skip.error || skip.data !== "published", skip.error?.message ?? String(skip.data));
    const img = await user.from("listing_images").insert({ listing_id: someListing.id, storage_path: `${someListing.seller_id}/${someListing.id}/${randomUUID()}.webp` });
    check("user cannot add photos to someone else's listing", !!img.error);
    await service.from("listings").delete().eq("id", lid);
  }
  for (const [fn, args] of [
    ["admin_overview", {}],
    ["admin_search_users", { p_query: "a" }],
    ["admin_promote_listing", { p_listing_id: someListing.id, p_kind: "feature", p_days: 30 }],
    ["admin_set_office_plan", { p_office_id: 1, p_plan_slug: "premium", p_months: 12 }],
    ["admin_review_office_verification", { p_request_id: 1, p_approve: true }],
    ["admin_set_listing_expiry", { p_listing_id: someListing.id, p_expires_at: "2099-01-01" }],
    ["admin_set_user_status", { p_user_id: otherUser.id, p_status: "suspended", p_reason: "probe" }],
    ["admin_anonymize_user", { p_user_id: otherUser.id, p_reason: "probe" }],
  ]) {
    const r = await user.rpc(fn, args);
    check(`user cannot call ${fn}`, !!r.error, r.error?.code ?? "allowed!");
  }
  const office = await user.from("offices").insert({ owner_id: me, name: "Probe office", plan_slug: "premium", verified_until: "2099-01-01" }).select("plan_slug, verified_until");
  check("user cannot give their office a package or badge", !!office.error || (!office.data?.[0]?.plan_slug && !office.data?.[0]?.verified_until), office.error?.message);
  const otherOffice = await user.from("offices").insert({ owner_id: otherUser.id, name: "Fake office" });
  check("user cannot create an office for someone else", !!otherOffice.error);

  // 3. Storage.
  const { data: privatePhoto } = await service.from("listing_images").select("storage_path").limit(1).single();
  if (privatePhoto) {
    const r = await user.storage.from("listing-photos").download(privatePhoto.storage_path);
    check("user cannot download other people's private photos", !!r.error);
  }
  const pubUp = await user.storage.from("listing-photos-public").upload(`${me}/x.png`, new Blob(["x"], { type: "image/png" }));
  check("user cannot write to the public photo bucket", !!pubUp.error);
  const html = await user.storage.from("office-documents").upload(`${me}/${randomUUID()}.pdf`, new Blob(["<script>alert(1)</script>"], { type: "text/html" }));
  check("office documents refuse HTML files", !!html.error);
  const otherFolder = await user.storage.from("office-documents").upload(`${otherUser.id}/${randomUUID()}.pdf`, new Blob(["%PDF"], { type: "application/pdf" }));
  check("user cannot upload into someone else's document folder", !!otherFolder.error);
  const ownDoc = `${me}/${randomUUID()}.pdf`;
  await user.storage.from("office-documents").upload(ownDoc, new Blob(["%PDF"], { type: "application/pdf" }));
  const anonDoc = await anon.storage.from("office-documents").download(ownDoc);
  check("visitors cannot download office documents", !!anonDoc.error);
  await service.storage.from("office-documents").remove([ownDoc]);

  // 4. Web: headers, redirects, protected endpoints.
  const home = await fetch(site, { redirect: "manual" });
  for (const h of ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy", "x-frame-options", "permissions-policy"]) {
    check(`header ${h}`, home.headers.has(h) || (h === "x-frame-options" && /frame-ancestors/.test(home.headers.get("content-security-policy") ?? "")));
  }
  check("server software not advertised", !home.headers.get("x-powered-by"));
  for (const evil of ["//evil.example.com", "https://evil.example.com", "/\\evil.example.com", "javascript:alert(1)"]) {
    const r = await fetch(`${site}/auth/callback?code=x&next=${encodeURIComponent(evil)}`, { redirect: "manual" });
    const loc = r.headers.get("location") ?? "";
    check(`auth callback does not redirect to ${evil}`, !/evil\.example\.com|javascript:/i.test(loc), loc);
  }
  const cron = await fetch(`${site}/api/cron/cleanup`);
  check("cleanup job refuses calls without the secret", cron.status === 401 || cron.status === 403 || cron.status === 503, String(cron.status));
  const cronBad = await fetch(`${site}/api/cron/cleanup`, { headers: { authorization: "Bearer wrong" } });
  check("cleanup job refuses a wrong secret", cronBad.status === 401 || cronBad.status === 403 || cronBad.status === 503, String(cronBad.status));
  const health = await (await fetch(`${site}/api/health`)).text();
  check("health check reveals nothing sensitive", !/supabase|key|secret|password|@/i.test(health), health.slice(0, 120));
  const admin = await fetch(`${site}/admin`, { redirect: "manual" });
  check("admin area not open to visitors", admin.status !== 200 || !(await admin.text()).includes("admin_overview"), String(admin.status));
} finally {
  await service.from("offices").delete().eq("owner_id", me);
  await service.from("listings").delete().eq("seller_id", me);
  await service.auth.admin.deleteUser(me);
}
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures ? 1 : 0);
