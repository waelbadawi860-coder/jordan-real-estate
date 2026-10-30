import type { MetadataRoute } from "next";
import { listingPath } from "@/lib/paths";
import { localePath, locales } from "@/i18n/config";
import { getAreaFacets, getReferenceData, getSitemapListings } from "@/lib/data/public";
import { seoSearchesWithListings, seoSearchPath } from "@/lib/seo-search";
import { publicEnv } from "@/lib/env";

// Only published listings appear here; drafts, rejected, expired and
// withdrawn listings are never exposed (the database query can't see them).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const [listings, ref, facets] = await Promise.all([getSitemapListings(), getReferenceData(), getAreaFacets()]);

  const staticPages = ["/", "/search", "/about", "/pricing"].flatMap((path) =>
    locales.map((locale) => ({
      url: `${base}${localePath(locale, path)}`,
      changeFrequency: "hourly" as const,
      priority: path === "/" ? 1 : 0.8,
    })),
  );

  const listingPages = listings.flatMap((listing) =>
    locales.map((locale) => ({
      url: `${base}${listingPath(locale, listing.id, listing.title)}`,
      lastModified: listing.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  );

  // "Apartments for sale in Abdoun" and the like, only while they have listings.
  const areaPages = seoSearchesWithListings(ref, facets).flatMap((s) =>
    locales.map((locale) => ({
      url: `${base}${seoSearchPath(locale, s)}`,
      changeFrequency: "daily" as const,
      priority: s.hood ? 0.5 : 0.7,
    })),
  );

  return [...staticPages, ...areaPages, ...listingPages];
}
