import type { MetadataRoute } from "next";
import { listingPath } from "@/lib/paths";
import { localePath, locales } from "@/i18n/config";
import { getSitemapListings } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";

// Only published listings appear here; drafts, rejected, expired and
// withdrawn listings are never exposed (the database query can't see them).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL;
  const listings = await getSitemapListings();

  const staticPages = ["/", "/search"].flatMap((path) =>
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

  return [...staticPages, ...listingPages];
}
