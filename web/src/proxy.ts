import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { earlyDecision } from "@/lib/route-guards";

// Runs before each page request:
//  1. Language routing — Arabic is served at the root ("/search"), English
//     under "/en". Internally every page lives under app/[lang], so Arabic
//     URLs are rewritten to "/ar/...". Visiting "/ar/..." redirects to the
//     clean URL so each page has a single address.
//  2. Keeps the user's login session fresh.
//  3. Answers with a real status code (404, login or terms redirect, outdated
//     listing address) before the page starts streaming; see lib/route-guards.
// The pages and actions still verify the user themselves, and the database
// enforces RLS: these early answers are about correct status codes.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  const isEnglish = pathname === "/en" || pathname.startsWith("/en/");
  const rewriteUrl = isEnglish ? null : new URL(`/ar${pathname === "/" ? "" : pathname}${search}`, request.url);

  const makeResponse = () =>
    rewriteUrl ? NextResponse.rewrite(rewriteUrl, { request }) : NextResponse.next({ request });

  let response = makeResponse();

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = makeResponse();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Validates the session and refreshes it if needed. Do not remove.
  const { data: claims } = await supabase.auth.getClaims();

  // Only page loads: form submissions (Server Actions) post to the page's
  // own address and must reach it.
  if ((request.method === "GET" || request.method === "HEAD") && !request.headers.has("next-action")) {
    const lang = isEnglish ? "en" : "ar";
    const path = isEnglish ? pathname.slice(3) || "/" : pathname;
    const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
    const decision = await earlyDecision(supabase, userId, lang, path, pathname + search, request.nextUrl.searchParams);
    if (decision) {
      const early =
        "notFound" in decision
          ? // Any address without a page renders the not-found page with a 404 status.
            NextResponse.rewrite(new URL(`/${lang}/not-found-404`, request.url), { request })
          : NextResponse.redirect(new URL(decision.redirect, request.url), decision.status);
      response.cookies.getAll().forEach((cookie) => early.cookies.set(cookie));
      return early;
    }
  }

  return response;
}

export const config = {
  // Skip Next.js internals, metadata files and static assets.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
