import { describe, expect, it } from "vitest";
import type { AreaFacet, ReferenceData } from "@/lib/data/public";
import { parseSearchParams } from "@/lib/search";
import { isPlainSeoSearch, seoSearchCount, seoSearchesWithListings, seoSearchOf, seoSearchPath, seoSearchTitle } from "@/lib/seo-search";

const ref = {
  cities: [{ id: 1, slug: "amman", name: { ar: "عمّان", en: "Amman" } }],
  neighborhoods: [{ id: 5, cityId: 1, slug: "abdoun", name: { ar: "عبدون", en: "Abdoun" } }],
  propertyTypes: [{ id: 2, slug: "apartment", name: { ar: "شقة", en: "Apartment" } }],
  settings: {},
} as unknown as ReferenceData;
const facets: AreaFacet[] = [
  { deal: "sale", typeId: 2, cityId: 1, hoodId: 5, count: 4 },
  { deal: "sale", typeId: 2, cityId: 1, hoodId: null, count: 1 },
];
const text = { forSale: "للبيع", forRent: "للإيجار", allTypes: "عقارات", what: "{type} {deal} في {place}", jordan: "الأردن" };
const seoOf = (q: Record<string, string>) => seoSearchOf(parseSearchParams(q).filters)!;

describe("indexable search pages", () => {
  it("names the page after the deal, type and area", () => {
    const s = seoOf({ deal: "sale", type: "apartment", city: "amman", hood: "abdoun" });
    expect(seoSearchTitle("ar", s, ref, text)).toBe("شقة للبيع في عبدون، عمّان");
    expect(seoSearchPath("ar", s)).toBe("/search?deal=sale&type=apartment&city=amman&hood=abdoun");
    expect(seoSearchCount(s, ref, facets)).toBe(4);
    expect(seoSearchCount(seoOf({ deal: "sale", type: "all", city: "amman" }), ref, facets)).toBe(5);
  });

  it("treats extra filters as the same page (canonical), not a new one", () => {
    const filters = parseSearchParams({ deal: "sale", type: "apartment", city: "amman", max: "100000" }).filters;
    const s = seoSearchOf(filters)!;
    expect(seoSearchPath("ar", s)).toBe("/search?deal=sale&type=apartment&city=amman");
    expect(isPlainSeoSearch(filters, s)).toBe(false);
  });

  it("has no own page without a deal and a governorate", () => {
    expect(seoSearchOf(parseSearchParams({ deal: "all", city: "amman" }).filters)).toBeNull();
    expect(seoSearchOf(parseSearchParams({ deal: "sale" }).filters)).toBeNull();
  });

  it("lists only pages that have listings, for the sitemap", () => {
    const pages = seoSearchesWithListings(ref, facets).map((s) => `${s.deal}/${s.type}/${s.city}/${s.hood ?? ""}`).sort();
    expect(pages).toEqual(["sale/all/amman/", "sale/all/amman/abdoun", "sale/apartment/amman/", "sale/apartment/amman/abdoun"]);
  });
});
