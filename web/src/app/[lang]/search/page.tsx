import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BoardSearch, BoardTags } from "@/components/board-filters";
import { cardLabels, FeaturedList, ListingCard, listingListClass } from "@/components/listing-card";
import { LoadMore } from "@/components/load-more";
import { SaveSearch } from "@/components/save-search";
import { SearchForm } from "@/components/search-form";
import { FilterDrawer } from "@/components/filter-drawer";
import { hasLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getAreaFacets, getFeaturedListings, getReferenceData, searchListings, type AreaFacet, type ReferenceData } from "@/lib/data/public";
import { t } from "@/lib/format";
import { filtersToQuery, parseSearchParams, type SearchFilters } from "@/lib/search";
import { isPlainSeoSearch, seoSearchCount, seoSearchOf, seoSearchPath, seoSearchTitle } from "@/lib/seo-search";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const [dict, ref, facets, sp] = await Promise.all([getDictionary(lang), getReferenceData(), getAreaFacets(), searchParams]);
  const { filters } = parseSearchParams(sp);
  const seo = seoSearchOf(filters);
  if (!seo) {
    return {
      title: dict.search.resultsTitle,
      alternates: { canonical: localePath(lang, "/search"), languages: { ar: localePath("ar", "/search"), en: localePath("en", "/search") } },
      // Only the plain search page itself is indexed among general searches.
      ...(filtersToQuery(filters) ? { robots: { index: false, follow: true } } : {}),
    };
  }
  // "Apartments for sale in Abdoun": its own address, title and description.
  const count = seoSearchCount(seo, ref, facets);
  const title = seoSearchTitle(lang, seo, ref, dict.seo);
  return {
    title,
    description: t(dict.seo.description, { title, n: count }),
    alternates: {
      canonical: seoSearchPath(lang, seo),
      languages: { ar: seoSearchPath("ar", seo), en: seoSearchPath("en", seo) },
    },
    // Extra filters (price, rooms, sort…) or an empty page aren't indexed.
    ...(!isPlainSeoSearch(filters, seo) || count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, ref, facets] = await Promise.all([getDictionary(lang), getReferenceData(), getAreaFacets()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <h1 className="mb-3 text-xl font-extrabold">{dict.search.resultsTitle}</h1>
      {/* The filters and results depend on the URL, so they render per request. */}
      <Suspense fallback={<ResultsFallback locale={lang} dict={dict} refData={ref} facets={facets} />}>
        <Results locale={lang} dict={dict} refData={ref} facets={facets} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({
  locale,
  dict,
  refData,
  facets,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  refData: ReferenceData;
  facets: AreaFacet[];
  searchParams: PageProps<"/[lang]/search">["searchParams"];
}) {
  const { filters, hadInvalid } = parseSearchParams(await searchParams);
  const [page, featured] = await Promise.all([searchListings(filters, null), getFeaturedListings(filters)]);
  const labels = cardLabels(dict);
  // Featured listings sit on top; on the first page they aren't repeated below.
  const featuredIds = new Set(featured.map((l) => l.id));
  const items = page.items.filter((l) => !featuredIds.has(l.id));

  return (
    <Filters locale={locale} dict={dict} refData={refData} facets={facets} filters={filters}>
      {hadInvalid && (
        <p role="status" className="mt-3 text-sm text-accent">
          {dict.search.invalidFilters}
        </p>
      )}

      <section className="mt-1" aria-live="polite">
        <FeaturedList listings={featured} title={dict.search.featuredTitle} locale={locale} labels={labels} />
        <h2 className="sr-only">{dict.search.resultsTitle}</h2>
        {items.length === 0 && featured.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="font-bold">{dict.search.noResults}</p>
            <p className="mt-1 text-muted">{dict.search.noResultsHint}</p>
          </div>
        ) : (
          <>
            <ul className={listingListClass}>
              {items.map((listing, index) => (
                <li key={listing.id}>
                  <ListingCard listing={listing} locale={locale} labels={labels} priority={index < 2} />
                </li>
              ))}
            </ul>
            <LoadMore
              filters={filters}
              initialCursor={page.nextCursor}
              locale={locale}
              labels={labels}
              text={{ loadMore: dict.search.loadMore, loading: dict.search.loading, loadError: dict.search.loadError }}
            />
          </>
        )}
      </section>
      {/* After the results: the page starts with ads. Only when the search names at least a deal, type or governorate (else it would match every ad). */}
      {((filters.deal && filters.deal !== "all") || (filters.type && filters.type !== "all") || filters.city) && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4">
          <SaveSearch
            filters={filters}
            loginHref={`${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, "/search") + filtersToQuery(filters))}`}
            manageHref={localePath(locale, "/my/follows")}
            text={dict.saveSearch}
          />
        </div>
      )}
    </Filters>
  );
}

function ResultsFallback({
  locale,
  dict,
  refData,
  facets,
}: {
  locale: Locale;
  dict: Dictionary;
  refData: ReferenceData;
  facets: AreaFacet[];
}) {
  return (
    <Filters locale={locale} dict={dict} refData={refData} facets={facets}>
      <ul className={`mt-1 ${listingListClass}`} aria-busy="true" aria-label={dict.search.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-32 animate-pulse bg-border/40" />
        ))}
      </ul>
    </Filters>
  );
}

/**
 * Search box with a "Filters" button beside it, then the quick tags. The
 * detailed search opens in a panel over the page (FilterDrawer), so the
 * results never move.
 */
function Filters({
  locale,
  dict,
  refData,
  facets,
  filters,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  refData: ReferenceData;
  facets: AreaFacet[];
  filters?: SearchFilters;
  children: ReactNode;
}) {
  const activeCount = filters
    ? [filters.min, filters.max, filters.amin, filters.amax, filters.beds, filters.baths, filters.floors, filters.floor].filter((v) => v !== undefined)
        .length + (filters.sort !== "newest" ? 1 : 0)
    : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <BoardSearch locale={locale} dict={dict} q={filters?.q} />
        </div>
        <FilterDrawer label={dict.search.detailedSearch} closeLabel={dict.search.closeFilters} activeCount={activeCount}>
          {/* Keyed by the current search, so the form shows the new choices after a tag is clicked. */}
          <SearchForm
            key={filtersToQuery(filters ?? { sort: "newest" })}
            locale={locale}
            dict={{ search: dict.search, floors: dict.floors }}
            refData={{ cities: refData.cities, neighborhoods: refData.neighborhoods, propertyTypes: refData.propertyTypes }}
            facets={facets}
            filters={filters}
          />
        </FilterDrawer>
      </div>
      <BoardTags locale={locale} dict={dict} refData={refData} filters={filters} facets={facets} />
      <div>{children}</div>
    </div>
  );
}
