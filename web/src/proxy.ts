import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

// Runs before each page request:
//  1. Language routing — Arabic is served at the root ("/search"), English
//     under "/en". Internally every page lives under app/[lang], so Arabic
//     URLs are rewritten to "/ar/...". Visiting "/ar/..." redirects to the
//     clean URL so each page has a single address.
//  2. Keeps the user's login session fresh.
// This is NOT a security check: protected pages and actions verify the user
// again on the server, and the database enforces RLS.
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
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Skip Next.js internals, metadata files and static assets.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
