import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, localePath } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Landing page for the custom email templates (supabase/templates/*.html),
// which become active once a custom email provider is configured. Unlike
// /auth/callback, these links work from any device or browser.
const allowedTypes: EmailOtpType[] = ["email", "signup", "recovery", "email_change"];

export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/auth/confirm">) {
  const { lang } = await params;
  const locale = hasLocale(lang) ? lang : "ar";
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"), localePath(locale, "/my/listings"));
  const base = new URL("/", request.url);

  if (tokenHash && type && allowedTypes.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, base));
  }

  return NextResponse.redirect(new URL(`${localePath(locale, "/login")}?error=link`, base));
}
