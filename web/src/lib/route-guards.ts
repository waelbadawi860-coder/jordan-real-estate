import type { SupabaseClient } from "@supabase/supabase-js";
import { localePath, type Locale } from "@/i18n/config";
import type { Database } from "@/lib/database.types";
import { slugify } from "@/lib/format";
import { listingPath } from "@/lib/paths";

// Decisions that must be made before a page starts streaming. With Cache
// Components the page shell is sent with status 200 straight away, so a
// notFound() or redirect() inside the page can no longer change the status.
// The proxy asks these questions first and answers with a real 404 or
// redirect. The pages keep their own checks as well.

export type EarlyDecision = { redirect: string; status: 307 | 308 } | { notFound: true } | null;

const PROTECTED = /^\/(my(\/|$)|post$|admin(\/|$)|accept-terms$)/;
const NEEDS_CONSENT = /^\/(my(\/|$)|post$)/;
const ID = "([0-9]{1,15})";

/** Same-site "return to" paths only (see safeNextPath in lib/auth). */
function safeNext(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://same.site");
    return parsed.origin === "http://same.site" ? parsed.pathname + parsed.search + parsed.hash : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param path    the address without the "/en" prefix, e.g. "/my/listings/12"
 * @param address the full address the visitor asked for (used for "return to")
 */
export async function earlyDecision(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  lang: Locale,
  path: string,
  address: string,
  searchParams: URLSearchParams,
): Promise<EarlyDecision> {
  // Exports stay hidden rather than inviting a login.
  if (!userId && path.startsWith("/admin/export")) return { notFound: true };
  if (!userId && PROTECTED.test(path)) {
    return { redirect: `${localePath(lang, "/login")}?next=${encodeURIComponent(address)}`, status: 307 };
  }
  if (userId && (path === "/login" || path === "/register")) {
    return { redirect: safeNext(searchParams.get("next"), localePath(lang, "/my/listings")), status: 307 };
  }

  if (userId && path.startsWith("/admin")) {
    const { data } = await supabase.from("profiles").select("role, status").eq("id", userId).maybeSingle();
    if (!data || data.role !== "admin" || data.status !== "active") return { notFound: true };
  }

  if (userId && (NEEDS_CONSENT.test(path) || path === "/accept-terms")) {
    const { data } = await supabase.rpc("pending_consents");
    const pending = (data?.length ?? 0) > 0;
    if (pending && path !== "/accept-terms") {
      return { redirect: `${localePath(lang, "/accept-terms")}?next=${encodeURIComponent(address)}`, status: 307 };
    }
    // Nothing left to accept: straight back to where they were going.
    if (!pending && data && path === "/accept-terms") {
      return { redirect: safeNext(searchParams.get("next"), localePath(lang, "/my/listings")), status: 307 };
    }
  }

  // The database only returns rows the visitor may see (RLS), so "no row" means 404.
  let m = path.match(new RegExp(`^/my/listings/${ID}(/|$)`));
  if (userId && m) {
    const { data } = await supabase.from("listings").select("id").eq("id", Number(m[1])).eq("seller_id", userId).maybeSingle();
    if (!data) return { notFound: true };
  }

  m = path.match(new RegExp(`^/my/commissions/${ID}$`));
  if (userId && m) {
    const { data } = await supabase.from("commission_records").select("id").eq("id", Number(m[1])).eq("seller_id", userId).maybeSingle();
    if (!data) return { notFound: true };
  }

  // Ads and offices are addressed by number; anything else there doesn't exist.
  if (/^\/(property|office)\//.test(path) && !new RegExp(`^/(property|office)/${ID}(/|$)`).test(path)) return { notFound: true };

  m = path.match(new RegExp(`^/property/${ID}(?:/([^/]+))?/?$`));
  if (m) {
    const { data } = await supabase.from("listings").select("id, title").eq("id", Number(m[1])).eq("status", "published").gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!data) return { notFound: true };
    // One address per listing: outdated or missing title slugs move permanently.
    let given = "";
    try {
      given = m[2] ? decodeURIComponent(m[2]) : "";
    } catch {
      // A broken address: send it to the right one below.
    }
    const expected = slugify(data.title);
    if (expected && given !== expected) return { redirect: listingPath(lang, data.id, data.title), status: 308 };
  }

  m = path.match(new RegExp(`^/office/${ID}/?$`));
  if (m) {
    const { data } = await supabase.from("offices").select("id").eq("id", Number(m[1])).eq("status", "active").maybeSingle();
    if (!data) return { notFound: true };
  }

  return null;
}
