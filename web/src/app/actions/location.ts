"use server";

import { GOOGLE_MAPS_HOSTS, inJordan, isShortMapLink, parseLocation, SHORT_LINK_HOSTS, type LatLng } from "@/lib/geo";
import { withinVisitorLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type ResolveResult = { ok: true; position: LatLng } | { ok: false; error: "notFound" | "outsideJordan" | "tooMany" | "signIn" };

/**
 * Opens a Google Maps short link (maps.app.goo.gl/…) to read the position from
 * the full address it leads to. Only Google hosts are ever contacted, at most
 * four redirects, with a short time limit; nothing else is fetched.
 */
export async function resolveMapLinkAction(link: unknown): Promise<ResolveResult> {
  if (typeof link !== "string" || link.length > 500 || !isShortMapLink(link)) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "signIn" };
  if (!(await withinVisitorLimit("map_link", 20, 3600))) return { ok: false, error: "tooMany" };

  let current = new URL(link.trim());
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== "https:" || ![...SHORT_LINK_HOSTS, ...GOOGLE_MAPS_HOSTS].includes(current.hostname)) break;
    const found = parseLocation(current.href);
    if (found) return inJordan(found) ? { ok: true, position: found } : { ok: false, error: "outsideJordan" };
    let res: Response;
    try {
      res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "user-agent": "Mozilla/5.0" } });
    } catch {
      break;
    }
    const next = res.headers.get("location");
    if (!next) break;
    current = new URL(next, current);
  }
  const last = parseLocation(current.href);
  if (last) return inJordan(last) ? { ok: true, position: last } : { ok: false, error: "outsideJordan" };
  return { ok: false, error: "notFound" };
}
