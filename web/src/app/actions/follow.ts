"use server";

import { z } from "zod";
import { getReferenceData } from "@/lib/data/public";
import { sanitizeFilters } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

// "Follow similar listings": the signed-in user follows the deal, property
// type, governorate and area of a listing. The database limits each user to
// 20 follows and only lets people manage their own.

export type FollowResult = { ok: true; id: number | null } | { ok: false; error: "signIn" | "limit" | "generic" };

export async function followSimilarAction(listingId: unknown): Promise<FollowResult> {
  const id = z.number().int().positive().safeParse(listingId);
  if (!id.success) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, error: "signIn" };

  const { data: listing } = await supabase
    .from("listings")
    .select("deal_type, property_type_id, city_id, neighborhood_id")
    .eq("id", id.data)
    .eq("status", "published")
    .maybeSingle();
  if (!listing) return { ok: false, error: "generic" };

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: userId,
      deal_type: listing.deal_type,
      property_type_id: listing.property_type_id,
      city_id: listing.city_id,
      neighborhood_id: listing.neighborhood_id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: true, id: null }; // already following
    if (error.code === "42501") return { ok: false, error: "limit" };
    return { ok: false, error: "generic" };
  }
  return { ok: true, id: data.id };
}

export async function unfollowAction(savedSearchId: unknown): Promise<{ ok: boolean }> {
  const id = z.number().int().positive().safeParse(savedSearchId);
  if (!id.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("saved_searches").delete().eq("id", id.data);
  return { ok: !error };
}

/** One-click unsubscribe from the link in an e-mail (works without signing in). */
export async function unsubscribeAction(token: unknown): Promise<{ ok: boolean }> {
  const t = z.string().uuid().safeParse(token);
  if (!t.success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsubscribe_saved_search", { p_token: t.data });
  return { ok: !error && data === true };
}

export type SaveSearchResult = { ok: true } | { ok: false; error: "signIn" | "limit" | "tooBroad" | "generic" };

/**
 * "Save this search" on the results page: deal, property type, governorate,
 * area, maximum price and "direct from owner". Other filters (minimum price,
 * area, rooms, words) aren't kept: alerts match on these fields only.
 */
export async function saveSearchAction(input: unknown): Promise<SaveSearchResult> {
  const filters = sanitizeFilters(input);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, error: "signIn" };

  const ref = await getReferenceData();
  const type = filters.type && filters.type !== "all" ? ref.propertyTypes.find((t) => t.slug === filters.type) : undefined;
  const city = filters.city ? ref.cities.find((c) => c.slug === filters.city) : undefined;
  const hood = filters.hood ? ref.neighborhoods.find((n) => n.slug === filters.hood && (!city || n.cityId === city.id)) : undefined;
  const deal = filters.deal === "sale" || filters.deal === "rent" ? filters.deal : null;
  // Following "everything" would notify on every new ad.
  if (!deal && !type && !city) return { ok: false, error: "tooBroad" };

  const { error } = await supabase.from("saved_searches").insert({
    user_id: userId,
    deal_type: deal,
    property_type_id: type?.id ?? null,
    city_id: city?.id ?? hood?.cityId ?? null,
    neighborhood_id: hood?.id ?? null,
    max_price: filters.max ?? null,
    owner_only: filters.own === "1",
  });
  if (error) {
    if (error.code === "23505") return { ok: true }; // already saved
    if (error.code === "42501") return { ok: false, error: "limit" };
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}
