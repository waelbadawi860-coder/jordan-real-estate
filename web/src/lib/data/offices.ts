import "server-only";
import { createClient as createPublicClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Real-estate offices: public office pages and the "verified office" badge,
// the owner's own office page, and the package list.

function publicClient() {
  return createPublicClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type OfficePlan = {
  slug: string;
  name: { ar: string; en: string };
  priceJod: number;
  maxActiveListings: number;
  featuredPerMonth: number;
  includesVerification: boolean;
};

export type PublicOffice = { id: number; ownerId: string; name: string; cityId: number | null; about: string | null; verified: boolean };

/** Badge info for every active office, keyed by the owner's user id. Cached; refreshed with the "offices" tag. */
export async function getOfficeDirectory(): Promise<Record<string, { id: number; name: string; verified: boolean }>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("offices");
  const { data, error } = await publicClient().from("offices").select("id, owner_id, name, verified_until").eq("status", "active");
  if (error) throw new Error(`Loading offices failed: ${error.message}`);
  const now = Date.now();
  return Object.fromEntries(
    (data ?? []).map((o) => [o.owner_id, { id: o.id, name: o.name, verified: !!o.verified_until && Date.parse(o.verified_until) > now }]),
  );
}

export async function getPublicOffice(id: number): Promise<PublicOffice | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("offices");
  const { data } = await publicClient()
    .from("offices")
    .select("id, owner_id, name, city_id, about, verified_until")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    cityId: data.city_id,
    about: data.about,
    verified: !!data.verified_until && Date.parse(data.verified_until) > Date.now(),
  };
}

export async function getOfficePlans(): Promise<OfficePlan[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("offices");
  const { data, error } = await publicClient().from("office_plans").select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(`Loading packages failed: ${error.message}`);
  return (data ?? []).map((p) => ({
    slug: p.slug,
    name: { ar: p.name_ar, en: p.name_en },
    priceJod: Number(p.price_jod),
    maxActiveListings: p.max_active_listings,
    featuredPerMonth: p.featured_per_month,
    includesVerification: p.includes_verification,
  }));
}

export type MyOffice = {
  id: number;
  name: string;
  phone: string | null;
  cityId: number | null;
  about: string | null;
  planSlug: string | null;
  planUntil: string | null;
  verifiedUntil: string | null;
  status: "active" | "suspended";
  latestRequest: { status: "pending" | "approved" | "rejected"; reason: string | null; createdAt: string } | null;
};

/** The signed-in user's office (RLS: owners read their own). */
export async function getMyOffice(userId: string): Promise<MyOffice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offices")
    .select("id, name, phone, city_id, about, plan_slug, plan_until, verified_until, status, office_verifications(status, reason, created_at)")
    .eq("owner_id", userId)
    .order("created_at", { referencedTable: "office_verifications", ascending: false })
    .limit(1, { referencedTable: "office_verifications" })
    .maybeSingle();
  if (error) throw new Error(`Loading the office failed: ${error.message}`);
  if (!data) return null;
  const req = data.office_verifications[0];
  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    cityId: data.city_id,
    about: data.about,
    planSlug: data.plan_slug,
    planUntil: data.plan_until,
    verifiedUntil: data.verified_until,
    status: data.status as "active" | "suspended",
    latestRequest: req ? { status: req.status as "pending" | "approved" | "rejected", reason: req.reason, createdAt: req.created_at } : null,
  };
}

export function isActiveUntil(until: string | null): boolean {
  return !!until && Date.parse(until) > Date.now();
}
