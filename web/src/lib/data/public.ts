import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database, Json } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import type { FloorLevel } from "@/lib/floor";
import { PAGE_SIZE, type Cursor, type SearchFilters } from "@/lib/search";

// Public data only. Uses the publishable key with no user session, so the
// database's RLS rules return nothing but published, unexpired listings.
// Results are cached briefly so popular pages don't hit the database each time.

function publicClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type LocalizedName = { ar: string; en: string };

export type City = { id: number; slug: string; name: LocalizedName };
export type Neighborhood = { id: number; cityId: number; slug: string; name: LocalizedName };
export type PropertyType = {
  id: number;
  slug: string;
  name: LocalizedName;
  hasBedrooms: boolean;
  hasBathrooms: boolean;
  hasFloor: boolean;
  hasFurnished: boolean;
  /** Which deals this type can be listed for (e.g. residential land: sale only). */
  allowedDeals: ("sale" | "rent")[];
};

export type ReferenceData = {
  cities: City[];
  neighborhoods: Neighborhood[];
  propertyTypes: PropertyType[];
  settings: Record<string, Json>;
};

export async function getReferenceData(): Promise<ReferenceData> {
  "use cache";
  cacheLife("hours");
  cacheTag("reference-data");

  const sb = publicClient();
  const [cities, neighborhoods, types, settings] = await Promise.all([
    sb.from("cities").select("id, slug, name_ar, name_en").order("sort_order").order("name_en"),
    sb.from("neighborhoods").select("id, city_id, slug, name_ar, name_en").order("sort_order").order("name_en"),
    sb.from("property_types").select("id, slug, name_ar, name_en, has_bedrooms, has_bathrooms, has_floor, has_furnished, allowed_deals").order("sort_order"),
    sb.from("site_settings").select("key, value"),
  ]);
  for (const result of [cities, neighborhoods, types, settings]) {
    if (result.error) throw new Error(`Loading reference data failed: ${result.error.message}`);
  }

  return {
    cities: cities.data!.map((c) => ({ id: c.id, slug: c.slug, name: { ar: c.name_ar, en: c.name_en } })),
    neighborhoods: neighborhoods.data!.map((n) => ({
      id: n.id,
      cityId: n.city_id,
      slug: n.slug,
      name: { ar: n.name_ar, en: n.name_en },
    })),
    propertyTypes: types.data!.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: { ar: t.name_ar, en: t.name_en },
      hasBedrooms: t.has_bedrooms,
      hasBathrooms: t.has_bathrooms,
      hasFloor: t.has_floor,
      hasFurnished: t.has_furnished,
      allowedDeals: t.allowed_deals,
    })),
    settings: Object.fromEntries(settings.data!.map((s) => [s.key, s.value])),
  };
}

export function siteName(ref: ReferenceData, locale: "ar" | "en"): string {
  const value = ref.settings[locale === "ar" ? "site_name_ar" : "site_name_en"];
  return typeof value === "string" ? value : "Aqar";
}

export function publicImageUrl(storagePath: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos-public/${storagePath}`;
}

export type ListingCard = {
  id: number;
  title: string;
  price: number;
  dealType: "sale" | "rent";
  rentPeriod: "monthly" | "yearly" | null;
  type: LocalizedName;
  city: LocalizedName;
  neighborhood: LocalizedName | null;
  areaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  publishedAt: string;
  imageUrl: string | null;
};

export const CARD_COLUMNS =
  "id, title, price, deal_type, property_type_id, city_id, neighborhood_id, area_sqm, bedrooms, bathrooms, details, published_at, listing_images(storage_path, thumb_path, position, public_copied_at)";

export type CardRow = {
  id: number;
  title: string;
  price: number;
  deal_type: "sale" | "rent";
  property_type_id: number;
  city_id: number;
  neighborhood_id: number | null;
  area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  details: Json;
  published_at: string | null;
  listing_images: { storage_path: string; thumb_path?: string | null; position: number; public_copied_at: string | null }[];
};

export function rentPeriodOf(details: Json): "monthly" | "yearly" | null {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const period = details.rent_period;
    if (period === "monthly" || period === "yearly") return period;
  }
  return null;
}

export function toCard(row: CardRow, ref: ReferenceData): ListingCard {
  const type = ref.propertyTypes.find((t) => t.id === row.property_type_id);
  const city = ref.cities.find((c) => c.id === row.city_id);
  const hood = ref.neighborhoods.find((n) => n.id === row.neighborhood_id);
  const image = row.listing_images
    .filter((i) => i.public_copied_at)
    .sort((a, b) => a.position - b.position)[0];
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price),
    dealType: row.deal_type,
    rentPeriod: rentPeriodOf(row.details),
    type: type?.name ?? { ar: "", en: "" },
    city: city?.name ?? { ar: "", en: "" },
    neighborhood: hood?.name ?? null,
    areaSqm: row.area_sqm === null ? null : Number(row.area_sqm),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    publishedAt: row.published_at ?? "",
    imageUrl: image ? publicImageUrl(image.thumb_path ?? image.storage_path) : null,
  };
}

function furnishedOf(details: Json): boolean | null {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return typeof details.furnished === "boolean" ? details.furnished : null;
  }
  return null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type ListingPage = { items: ListingCard[]; nextCursor: Cursor | null };

export async function searchListings(filters: SearchFilters, cursor: Cursor | null): Promise<ListingPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  const ref = await getReferenceData();
  const sb = publicClient();

  let query = sb
    .from("listings")
    .select(CARD_COLUMNS)
    .eq("status", "published")
    .order("position", { referencedTable: "listing_images" });

  if (filters.deal) query = query.eq("deal_type", filters.deal);
  if (filters.type) {
    const type = ref.propertyTypes.find((t) => t.slug === filters.type);
    if (!type) return { items: [], nextCursor: null };
    query = query.eq("property_type_id", type.id);
  }
  const city = filters.city ? ref.cities.find((c) => c.slug === filters.city) : undefined;
  if (filters.city && !city) return { items: [], nextCursor: null };
  if (city) query = query.eq("city_id", city.id);
  if (filters.hood) {
    const hood = ref.neighborhoods.find(
      (n) => n.slug === filters.hood && (!city || n.cityId === city.id),
    );
    if (!hood) return { items: [], nextCursor: null };
    query = query.eq("neighborhood_id", hood.id);
  }
  if (filters.min !== undefined) query = query.gte("price", filters.min);
  if (filters.max !== undefined) query = query.lte("price", filters.max);
  if (filters.amin !== undefined) query = query.gte("area_sqm", filters.amin);
  if (filters.amax !== undefined) query = query.lte("area_sqm", filters.amax);
  if (filters.beds !== undefined) query = query.gte("bedrooms", filters.beds);
  if (filters.floor) query = query.eq("floor_level", filters.floor);
  if (filters.q) query = query.ilike("title", `%${escapeLike(filters.q)}%`);

  // Keyset pagination: "give me the rows after the last one I saw".
  // Stays fast no matter how deep the visitor scrolls.
  if (filters.sort === "price_asc") {
    if (cursor) query = query.or(`price.gt.${Number(cursor.v)},and(price.eq.${Number(cursor.v)},id.gt.${cursor.id})`);
    query = query.order("price", { ascending: true }).order("id", { ascending: true });
  } else if (filters.sort === "price_desc") {
    if (cursor) query = query.or(`price.lt.${Number(cursor.v)},and(price.eq.${Number(cursor.v)},id.lt.${cursor.id})`);
    query = query.order("price", { ascending: false }).order("id", { ascending: false });
  } else {
    if (cursor) {
      const at = new Date(cursor.v).toISOString();
      query = query.or(`published_at.lt."${at}",and(published_at.eq."${at}",id.lt.${cursor.id})`);
    }
    query = query.order("published_at", { ascending: false }).order("id", { ascending: false });
  }

  const { data, error } = await query.limit(PAGE_SIZE + 1);
  if (error) throw new Error(`Listing search failed: ${error.message}`);

  const rows = (data ?? []) as unknown as CardRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).map((row) => toCard(row, ref));
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? { v: filters.sort === "newest" ? last.publishedAt : String(last.price), id: last.id }
      : null;
  return { items, nextCursor };
}

export type ListingDetail = ListingCard & {
  description: string;
  posterType: "owner" | "agent";
  updatedAt: string;
  expiresAt: string;
  images: { url: string; width: number | null; height: number | null }[];
  seller: { displayName: string; memberSince: string } | null;
  latitude: number | null;
  longitude: number | null;
  floor: FloorLevel | null;
  furnished: boolean | null;
};

export async function getListing(id: number): Promise<ListingDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings", `listing-${id}`);

  const ref = await getReferenceData();
  const sb = publicClient();
  const { data, error } = await sb
    .from("listings")
    .select(
      "id, title, price, deal_type, property_type_id, city_id, neighborhood_id, area_sqm, bedrooms, bathrooms, details, floor_level, published_at, description, poster_type, updated_at, expires_at, seller_id, approx_latitude, approx_longitude, listing_images(storage_path, position, public_copied_at, width, height)",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Loading listing failed: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as Omit<CardRow, "listing_images"> & {
    description: string;
    poster_type: "owner" | "agent";
    updated_at: string;
    expires_at: string;
    seller_id: string;
    approx_latitude: number | null;
    approx_longitude: number | null;
    floor_level: FloorLevel | null;
    listing_images: { storage_path: string; position: number; public_copied_at: string | null; width: number | null; height: number | null }[];
  };

  const seller = await sb.rpc("public_seller_info", { p_seller_id: row.seller_id });

  return {
    ...toCard(row, ref),
    description: row.description,
    posterType: row.poster_type,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    images: row.listing_images
      .filter((i) => i.public_copied_at)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ url: publicImageUrl(i.storage_path), width: i.width, height: i.height })),
    seller: seller.data?.[0]
      ? { displayName: seller.data[0].display_name, memberSince: seller.data[0].member_since }
      : null,
    // Only the rounded (≈1 km) position is ever public; the exact pin is private.
    latitude: row.approx_latitude === null ? null : Number(row.approx_latitude),
    longitude: row.approx_longitude === null ? null : Number(row.approx_longitude),
    floor: row.floor_level,
    furnished: furnishedOf(row.details),
  };
}

export type AreaFacet = { deal: "sale" | "rent"; typeId: number; cityId: number; hoodId: number | null; count: number };

/** How many public listings each deal/type/area combination has (for the linked search lists). */
export async function getAreaFacets(): Promise<AreaFacet[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  const { data, error } = await publicClient().rpc("listing_area_facets");
  if (error) throw new Error(`Loading area counts failed: ${error.message}`);
  return (data ?? []).map((f) => ({
    deal: f.deal_type,
    typeId: f.property_type_id,
    cityId: f.city_id,
    hoodId: f.neighborhood_id,
    count: Number(f.listings),
  }));
}

/** IDs and titles of every public listing, for the sitemap. */
export async function getSitemapListings(): Promise<{ id: number; title: string; updatedAt: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("listings");

  const sb = publicClient();
  const { data, error } = await sb
    .from("listings")
    .select("id, title, updated_at")
    .eq("status", "published")
    .order("id", { ascending: false })
    .limit(45000);
  if (error) throw new Error(`Sitemap query failed: ${error.message}`);
  return (data ?? []).map((l) => ({ id: l.id, title: l.title, updatedAt: l.updated_at }));
}
