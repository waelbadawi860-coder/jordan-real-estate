import "server-only";
import { notFound, redirect } from "next/navigation";
import { localePath, type Locale } from "@/i18n/config";
import { getOwnProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Admin access is checked on the server for every page and every action.
// The database checks it again (is_admin() in RLS policies and functions), so
// hiding links or guessing URLs can never grant access.

/** For admin pages: non-admins get a plain 404, so the dashboard isn't advertised. */
export async function requireAdminPage(locale: Locale, returnTo: string) {
  const user = await getSessionUser();
  if (!user) redirect(`${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, returnTo))}`);
  const profile = await getOwnProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "active") notFound();
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
  return { supabase, userId };
}

export const ADMIN_PAGE_SIZE = 25;
