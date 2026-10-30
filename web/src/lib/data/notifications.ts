import "server-only";
import type { Locale } from "@/i18n/config";
import { localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Json } from "@/lib/database.types";
import { t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// In-site notifications. Rows are created by the database (triggers and
// functions); users can only read their own and mark them as read (RLS).

export type NotificationItem = { id: number; text: string; href: string | null; read: boolean; createdAt: string };

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

function str(data: Json, key: string): string {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const v = data[key];
    if (typeof v === "string" || typeof v === "number") return String(v);
  }
  return "";
}

/** Turns a stored notification into a sentence and a link, in the visitor's language. */
export function describeNotification(type: string, data: Json, dict: Dictionary, locale: Locale): { text: string; href: string | null } {
  const n = dict.notifications.types as Record<string, string>;
  const listingId = str(data, "listing_id");
  const commissionId = str(data, "commission_id");
  const status = str(data, "status");
  const statusText =
    (dict.status as Record<string, string>)[status] ?? (dict.commission.statuses as Record<string, string>)[status] ?? status;
  const text = t(n[type] ?? n.other, { id: commissionId || listingId || str(data, "count"), status: statusText });
  const rawReason = str(data, "reason");
  const reason = rawReason === "auto_hold_reports" ? dict.notifications.autoHoldReason : rawReason;
  const full = reason ? `${text} — ${t(dict.notifications.reason, { reason })}` : text;

  const links: Record<string, string | null> = {
    listing_status_changed: `/my/listings/${listingId}`,
    listing_featured: `/my/listings/${listingId}`,
    similar_listing: `/property/${listingId}`,
    listing_bumped: `/my/listings/${listingId}`,
    office_verification_submitted: "/admin/offices",
    office_verified: "/my/office",
    office_verification_rejected: "/my/office",
    office_badge_removed: "/my/office",
    office_plan_active: "/my/office",
    listing_expiring: "/my/listings",
    listing_expired: "/my/listings",
    listing_submitted: `/admin/listings/${listingId}`,
    listing_reported: "/admin/reports",
    listing_auto_held: `/admin/listings/${listingId}`,
    system_failures: "/admin#system",
    user_reported: "/admin/reports",
    contact_message: "/admin/reports#messages",
    commission_reported: `/admin/commissions/${commissionId}`,
    payment_reported: `/admin/commissions/${commissionId}`,
    commission_disputed: `/admin/commissions/${commissionId}`,
    commission_updated: `/my/commissions/${commissionId}`,
    payment_verified: `/my/commissions/${commissionId}`,
    payment_rejected: `/my/commissions/${commissionId}`,
  };
  const path = links[type];
  return { text: full, href: path ? localePath(locale, path) : null };
}

export async function getMyNotifications(userId: string, dict: Dictionary, locale: Locale): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, data, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Loading notifications failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    ...describeNotification(row.type, row.data, dict, locale),
    read: row.read_at !== null,
    createdAt: row.created_at,
  }));
}
