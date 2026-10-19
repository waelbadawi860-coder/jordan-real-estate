import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, localePath } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Where Supabase's standard emails (confirm email / reset password) land.
// Exchanges the one-time code for a login session. This works only in the
// browser where the request started; if it fails after an email
// confirmation, the email is still confirmed, so we ask the person to log in.
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/auth/callback">) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : "ar";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), localePath(locale, "/my/listings"));
  const base = new URL("/", request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, base));
  }

  const isReset = next.endsWith("/reset-password");
  const fallback = isReset
    ? `${localePath(locale, "/forgot-password")}?error=link`
    : `${localePath(locale, "/login")}?confirmed=1`;
  return NextResponse.redirect(new URL(fallback, base));
}
