import "server-only";
import type { Json } from "@/lib/database.types";
import type { FloorLevel } from "@/lib/floor";
import { extrasOf, type ListingExtras } from "@/lib/listing-details";
import { CARD_COLUMNS, getReferenceData, rentPeriodOf, toCard, type CardRow, type ListingCard } from "@/lib/data/public";
import { createClient } from "@/lib/supabase/server";

// Private data for the logged-in seller. Never cached: every query runs as the
// user, and the database (RLS) only returns their own rows.

export type ListingStatus =
  | "draft"
  | "pending_approval"
  | "published"
  | "on_hold"
  | "rejected"
  | "expired"
  | "sold"
  | "rented"
  | "withdrawn"
  | "archived";

const SIGNED_URL_SECONDS = 3600;

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("listing-photos").createSignedUrls(paths, SIGNED_URL_SECONDS);
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  return map;
}

export type MyListingSummary = {
  id: number;
  title: string;
  status: ListingStatus;
  dealType: "sale" | "rent";
  price: number;
  rejectionReason: string | null;
  expiresAt: string | null;
  updatedAt: string;
  photoCount: number;
  thumbUrl: string | null;
  /** Agreement versions this listing was accepted under (commission system). */
  acceptedVersionIds: number[];
};

export async function getMyListings(userId: string): Promise<MyListingSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, status, deal_type, price, rejection_reason, expires_at, updated_at, listing_images(storage_path, thumb_path, position), accepted_agreements(agreement_version_id)")
    .eq("seller_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Loading your listings failed: ${error.message}`);

  const firstImage = (l: (typeof data)[number]) => [...l.listing_images].sort((a, b) => a.position - b.position)[0];
  const urls = await signedUrls(
    data.map((l) => firstImage(l)).filter(Boolean).map((i) => i!.thumb_path ?? i!.storage_path),
  );

  return data.map((l) => {
    const image = firstImage(l);
    return {
      id: l.id,
      title: l.title,
      status: l.status,
      dealType: l.deal_type,
      price: Number(l.price),
      rejectionReason: l.rejection_reason,
      expiresAt: l.expires_at,
      updatedAt: l.updated_at,
      photoCount: l.listing_images.length,
      thumbUrl: image ? (urls.get(image.thumb_path ?? image.storage_path) ?? null) : null,
      acceptedVersionIds: l.accepted_agreements.map((a) => a.agreement_version_id),
    };
  });
}

export type MyListingImage = { id: string; url: string | null; position: number };

export type MyListing = {
  id: number;
  status: ListingStatus;
  dealType: "sale" | "rent";
  rentPeriod: "monthly" | "yearly" | null;
  propertyTypeId: number;
  cityId: number;
  neighborhoodId: number | null;
  title: string;
  description: string;
  price: string;
  areaSqm: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorsCount: number | null;
  floor: FloorLevel | null;
  extras: ListingExtras;
  posterType: "owner" | "agent";
  rejectionReason: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  /** End of a paid "featured" promotion (may be in the past). */
  featuredUntil: string | null;
  updatedAt: string;
  contact: { phone: string; allowCalls: boolean; allowWhatsapp: boolean } | null;
  images: MyListingImage[];
  acceptances: { versionId: number; acceptedAt: string }[];
};

export async function getMyListing(userId: string, id: number): Promise<MyListing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, status, deal_type, details, property_type_id, city_id, neighborhood_id, title, description, price, area_sqm, bedrooms, bathrooms, floor_level, floors_count, poster_type, rejection_reason, expires_at, published_at, featured_until, updated_at, listing_contacts(phone, allow_calls, allow_whatsapp), listing_images(id, storage_path, position), accepted_agreements(agreement_version_id, accepted_at)",
    )
    .eq("id", id)
    .eq("seller_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Loading the listing failed: ${error.message}`);
  if (!data) return null;

  const images = [...data.listing_images].sort((a, b) => a.position - b.position);
  const urls = await signedUrls(images.map((i) => i.storage_path));
  const contact = Array.isArray(data.listing_contacts) ? data.listing_contacts[0] : data.listing_contacts;

  return {
    id: data.id,
    status: data.status,
    dealType: data.deal_type,
    rentPeriod: rentPeriodOf(data.details),
    propertyTypeId: data.property_type_id,
    cityId: data.city_id,
    neighborhoodId: data.neighborhood_id,
    title: data.title,
    description: data.description,
    price: String(data.price),
    areaSqm: data.area_sqm === null ? null : String(data.area_sqm),
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    floorsCount: data.floors_count,
    floor: data.floor_level,
    extras: extrasOf(data.details),
    posterType: data.poster_type,
    rejectionReason: data.rejection_reason,
    expiresAt: data.expires_at,
    publishedAt: data.published_at,
    featuredUntil: data.featured_until,
    updatedAt: data.updated_at,
    contact: contact ? { phone: contact.phone, allowCalls: contact.allow_calls, allowWhatsapp: contact.allow_whatsapp } : null,
    images: images.map((i) => ({ id: i.id, url: urls.get(i.storage_path) ?? null, position: i.position })),
    acceptances: data.accepted_agreements.map((a) => ({ versionId: a.agreement_version_id, acceptedAt: a.accepted_at })),
  };
}

export type FavouriteItem = { listingId: number; listing: ListingCard | null };

/** Saved listings. Ones no longer public come back as `listing: null`. */
export async function getMyFavourites(userId: string): Promise<FavouriteItem[]> {
  const supabase = await createClient();
  const [ref, { data, error }] = await Promise.all([
    getReferenceData(),
    supabase
      .from("favourites")
      .select(`listing_id, created_at, listings(${CARD_COLUMNS})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (error) throw new Error(`Loading favourites failed: ${error.message}`);
  return (data ?? []).map((row) => {
    const listing = row.listings as unknown as CardRow | null;
    return { listingId: row.listing_id, listing: listing ? toCard(listing, ref) : null };
  });
}

export async function isFavourite(userId: string, listingId: number): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favourites")
    .select("listing_id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();
  return Boolean(data);
}

/** The user's follow of this deal/type/governorate/area combination, if any. */
export async function getFollowId(
  userId: string,
  c: { dealType: "sale" | "rent"; typeId: number; cityId: number; neighborhoodId: number | null },
): Promise<number | null> {
  const supabase = await createClient();
  let query = supabase
    .from("saved_searches")
    .select("id")
    .eq("user_id", userId)
    .eq("deal_type", c.dealType)
    .eq("property_type_id", c.typeId)
    .eq("city_id", c.cityId);
  query = c.neighborhoodId === null ? query.is("neighborhood_id", null) : query.eq("neighborhood_id", c.neighborhoodId);
  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}

