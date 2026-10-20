import "server-only";
import { notFound, redirect } from "next/navigation";
import { localePath, type Locale } from "@/i18n/config";
import { getOwnProfile, getSessionUser } from "@/lib/auth";
import { isLiveSite } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Admin access is checked on the server for every page and every action.
// The database checks it again (is_admin() in RLS policies and functions), so
// hiding links or guessing URLs can never grant access.

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Two-step login: on the live site always, elsewhere when the admin setting
 * is on, an administrator session must have confirmed an authenticator-app
 * code (session level "aal2").
 */
async function secondStepMissing(supabase: ServerClient, aal: unknown): Promise<boolean> {
  if (aal === "aal2") return false;
  if (isLiveSite) return true;
  const { data } = await supabase.from("site_settings").select("value").eq("key", "require_admin_mfa").maybeSingle();
  return data?.value === true;
}

/** For admin pages: non-admins get a plain 404, so the dashboard isn't advertised. */
export async function requireAdminPage(locale: Locale, returnTo: string) {
  const user = await getSessionUser();
  if (!user) redirect(`${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, returnTo))}`);
  const profile = await getOwnProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "active") notFound();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (await secondStepMissing(supabase, data?.claims?.aal)) {
    redirect(`${localePath(locale, "/my/security")}?next=${encodeURIComponent(localePath(locale, returnTo))}`);
  }
  return { user, profile };
}

/** For admin Server Actions and route handlers: returns null when not allowed. */
export async function getAdminActor() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") return null;
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", userId).maybeSingle();
  if (!profile || profile.role !== "admin" || profile.status !== "active") return null;
  if (await secondStepMissing(supabase, data?.claims?.aal)) return null;
  return { supabase, userId, aal: data?.claims?.aal };
}

export const ADMIN_PAGE_SIZE = 25;
