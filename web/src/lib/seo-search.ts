import { localePath, type Locale } from "@/i18n/config";
import type { AreaFacet, ReferenceData } from "@/lib/data/public";
import { filtersToQuery, type SearchFilters } from "@/lib/search";

// Search engines get one page per "deal + property type + governorate (+ area)",
// e.g. /search?deal=sale&type=apartment&city=amman&hood=abdoun ("Apartments for
// sale in Abdoun"). Any other filter (price, rooms, sort, words…) points to that
// page as canonical and isn't indexed, so the index holds no endless duplicates.

export type SeoSearch = { deal: "sale" | "rent"; type: string; city: string; hood?: string };

type SeoText = { forSale: string; forRent: string; allTypes: string; what: string; jordan: string };

/** The indexable page a search belongs to, or null for a general search. */
export function seoSearchOf(filters: SearchFilters): SeoSearch | null {
  if (filters.deal !== "sale" && filters.deal !== "rent") return null;
  if (!filters.city) return null;
  return { deal: filters.deal, type: filters.type ?? "all", city: filters.city, hood: filters.hood };
}

export function seoSearchPath(locale: Locale, s: SeoSearch): string {
  return localePath(locale, "/search") + filtersToQuery({ sort: "newest", deal: s.deal, type: s.type, city: s.city, hood: s.hood });
}

/** True when the search has nothing beyond its indexable page's own filters. */
export function isPlainSeoSearch(filters: SearchFilters, s: SeoSearch): boolean {
  return filtersToQuery(filters) === filtersToQuery({ sort: "newest", deal: s.deal, type: s.type, city: s.city, hood: s.hood });
}

/** Live listings on that page (from the cached area counts). */
export function seoSearchCount(s: SeoSearch, ref: ReferenceData, facets: AreaFacet[]): number {
  const type = s.type === "all" ? null : ref.propertyTypes.find((t) => t.slug === s.type);
  const city = ref.cities.find((c) => c.slug === s.city);
  const hood = s.hood ? ref.neighborhoods.find((n) => n.slug === s.hood && n.cityId === city?.id) : null;
  if (!city || (s.type !== "all" && !type) || (s.hood && !hood)) return 0;
  return facets
    .filter((f) => f.deal === s.deal && f.cityId === city.id && (!type || f.typeId === type.id) && (!hood || f.hoodId === hood.id))
    .reduce((sum, f) => sum + f.count, 0);
}

/** "Apartment for sale in Abdoun, Amman" / «شقة للبيع في عبدون، عمّان». */
export function seoSearchTitle(locale: Locale, s: SeoSearch, ref: ReferenceData, text: SeoText): string {
  const type = s.type === "all" ? null : ref.propertyTypes.find((t) => t.slug === s.type);
  const city = ref.cities.find((c) => c.slug === s.city);
  const hood = s.hood ? ref.neighborhoods.find((n) => n.slug === s.hood) : null;
  const place = [hood?.name[locale], city?.name[locale] ?? text.jordan].filter(Boolean).join(locale === "ar" ? "، " : ", ");
  return text.what
    .replace("{type}", type?.name[locale] ?? text.allTypes)
    .replace("{deal}", s.deal === "sale" ? text.forSale : text.forRent)
    .replace("{place}", place);
}

/** Every indexable search page that has listings right now (for the sitemap). */
export function seoSearchesWithListings(ref: ReferenceData, facets: AreaFacet[]): SeoSearch[] {
  const seen = new Map<string, SeoSearch>();
  const add = (s: SeoSearch) => seen.set(`${s.deal}|${s.type}|${s.city}|${s.hood ?? ""}`, s);
  for (const f of facets) {
    if (f.count <= 0) continue;
    const type = ref.propertyTypes.find((t) => t.id === f.typeId);
    const city = ref.cities.find((c) => c.id === f.cityId);
    const hood = f.hoodId === null ? null : ref.neighborhoods.find((n) => n.id === f.hoodId);
    if (!type || !city) continue;
    for (const typeSlug of [type.slug, "all"]) {
      add({ deal: f.deal, type: typeSlug, city: city.slug });
      if (hood) add({ deal: f.deal, type: typeSlug, city: city.slug, hood: hood.slug });
    }
  }
  return [...seen.values()];
}
