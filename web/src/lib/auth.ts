import "server-only";
import { redirect } from "next/navigation";
import { localePath, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/** The logged-in user, verified from the session token, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
}

/** Redirects to the login page (then back) when nobody is logged in. */
export async function requireUser(locale: Locale, returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, returnTo))}`);
  return user;
}

export type Profile = {
  id: string;
  displayName: string;
  phone: string | null;
  preferredLanguage: "ar" | "en";
  role: "user" | "admin";
  status: "active" | "suspended" | "deletion_requested" | "deleted";
  createdAt: string;
};

export async function getOwnProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, phone, preferred_language, role, status, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    phone: data.phone,
    preferredLanguage: data.preferred_language === "en" ? "en" : "ar",
    role: data.role,
    status: data.status,
    createdAt: data.created_at,
  };
}

/**
 * Accepts only same-site paths for "return to" links, so a crafted link can't
 * send people to another website after logging in (open-redirect protection).
 */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // Browsers drop tabs and newlines inside addresses ("/\t/evil.com" becomes
  // "//evil.com"), so control characters and backslashes are refused, and the
  // result must still point at this site once parsed.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://same.site");
    if (parsed.origin !== "http://same.site") return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
