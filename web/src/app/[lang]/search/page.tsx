import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cardLabels, ListingCard } from "@/components/listing-card";
import { LoadMore } from "@/components/load-more";
import { SearchForm } from "@/components/search-form";
import { hasLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getReferenceData, searchListings, type ReferenceData } from "@/lib/data/public";
import { parseSearchParams } from "@/lib/search";

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
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold">{dict.search.resultsTitle}</h1>
      {/* The filters and results depend on the URL, so they render per request. */}
      <Suspense fallback={<ResultsFallback locale={lang} dict={dict} refData={ref} />}>
        <Results locale={lang} dict={dict} refData={ref} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({
  locale,
  dict,
  refData,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  refData: ReferenceData;
  searchParams: PageProps<"/[lang]/search">["searchParams"];
}) {
  const { filters, hadInvalid } = parseSearchParams(await searchParams);
  const page = await searchListings(filters, null);
  const labels = cardLabels(dict);

  return (
    <>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <SearchForm locale={locale} dict={dict} refData={refData} filters={filters} advanced />
      </div>
      {hadInvalid && (
        <p role="status" className="mt-3 text-sm text-accent">
          {dict.search.invalidFilters}
        </p>
      )}

      <section className="mt-6" aria-live="polite">
        {page.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="font-bold">{dict.search.noResults}</p>
            <p className="mt-1 text-muted">{dict.search.noResultsHint}</p>
          </div>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {page.items.map((listing, index) => (
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
    </>
  );
}

function ResultsFallback({ locale, dict, refData }: { locale: Locale; dict: Dictionary; refData: ReferenceData }) {
  return (
    <>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <SearchForm locale={locale} dict={dict} refData={refData} advanced />
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={dict.search.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-72 animate-pulse rounded-xl bg-border/60" />
        ))}
      </ul>
    </>
  );
}
