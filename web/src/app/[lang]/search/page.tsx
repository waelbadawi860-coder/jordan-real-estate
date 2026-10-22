import { SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BoardSearch, BoardTags } from "@/components/board-filters";
import { cardLabels, FeaturedList, ListingCard, listingListClass } from "@/components/listing-card";
import { LoadMore } from "@/components/load-more";
import { SearchForm } from "@/components/search-form";
import { SideDetails } from "@/components/side-details";
import { hasLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getAreaFacets, getFeaturedListings, getReferenceData, searchListings, type AreaFacet, type ReferenceData } from "@/lib/data/public";
import { filtersToQuery, parseSearchParams, type SearchFilters } from "@/lib/search";

export async function generateMetadata({ params }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.search.resultsTitle,
    alternates: {
      canonical: localePath(lang, "/search"),
      languages: { ar: localePath("ar", "/search"), en: localePath("en", "/search") },
    },
  };
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, ref, facets] = await Promise.all([getDictionary(lang), getReferenceData(), getAreaFacets()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 lg:max-w-6xl">
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
 * Search box and quick tags on top. Phones: the detailed filters stay folded
 * under the tags. Computers: they sit in a column on the right (the start
 * side in Arabic) beside the results.
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
  const detailed =
    filters &&
    [filters.min, filters.max, filters.amin, filters.amax, filters.beds, filters.baths, filters.floors, filters.floor].some((v) => v !== undefined);
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-x-6">
      <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-1">
        <BoardSearch locale={locale} dict={dict} q={filters?.q} />
        <BoardTags locale={locale} dict={dict} refData={refData} filters={filters} facets={facets} />
      </div>
      <aside className="lg:sticky lg:top-4 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <SideDetails
          open={detailed}
          summary={
            <>
              <SlidersHorizontal className="size-4" aria-hidden />
              {dict.search.detailedSearch}
            </>
          }
        >
          {/* Keyed by the current search, so the form shows the new choices after a tag is clicked. */}
          <SearchForm
            key={filtersToQuery(filters ?? { sort: "newest" })}
            locale={locale}
            dict={{ search: dict.search, floors: dict.floors }}
            refData={{ cities: refData.cities, neighborhoods: refData.neighborhoods, propertyTypes: refData.propertyTypes }}
            facets={facets}
            filters={filters}
          />
        </SideDetails>
      </aside>
      <div className="lg:col-start-2 lg:row-start-2">{children}</div>
    </div>
  );
}
