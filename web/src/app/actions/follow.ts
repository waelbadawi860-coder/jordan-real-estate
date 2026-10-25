"use server";

import { z } from "zod";
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
