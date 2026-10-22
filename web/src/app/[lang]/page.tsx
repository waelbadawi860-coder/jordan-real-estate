import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { WhyUs } from "@/components/why-us";
import { BoardSearch, BoardTags } from "@/components/board-filters";
import { cardLabels, FeaturedList, ListingCard, listingListClass } from "@/components/listing-card";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getFeaturedListings, getReferenceData, searchListings, siteName } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const [dict, ref, latest, featured] = await Promise.all([
    getDictionary(lang),
    getReferenceData(),
    searchListings({ sort: "newest" }, null),
    getFeaturedListings({ sort: "newest" }),
  ]);
  const labels = cardLabels(dict);
  // Featured listings sit on top and aren't repeated in the latest list.
  const featuredIds = new Set(featured.map((l) => l.id));
  const items = latest.items.filter((l) => !featuredIds.has(l.id));
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;

  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName(ref, lang),
    url: `${site}${localePath(lang, "/")}`,
    inLanguage: lang,
    potentialAction: {
      "@type": "SearchAction",
      target: `${site}${localePath(lang, "/search")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <JsonLd data={structured} />
      <h1 className="sr-only">{dict.search.heroTitle}</h1>
      <BoardSearch locale={lang} dict={dict} />
      <div className="mt-3">
        <BoardTags locale={lang} dict={dict} refData={ref} />
      </div>
      <div className="mt-3">
        <WhyUs locale={lang} dict={dict} />
      </div>

      <div className="mt-5">
        <FeaturedList listings={featured} title={dict.search.featuredTitle} locale={lang} labels={labels} />
      </div>
      <section className="mt-2" aria-labelledby="latest-heading">
        <h2 id="latest-heading" className="mb-2 text-base font-extrabold text-muted">
          {dict.home.latest}
        </h2>

        {items.length === 0 && featured.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-muted">
            {dict.home.empty}
          </p>
        ) : (
          <>
            <ul className={listingListClass}>
              {items.map((listing, index) => (
                <li key={listing.id}>
                  <ListingCard listing={listing} locale={lang} labels={labels} priority={index < 2} />
                </li>
              ))}
            </ul>
            <Link
              href={localePath(lang, "/search")}
              className="mt-4 flex h-11 items-center justify-center gap-1 rounded-lg border border-border bg-surface font-bold text-brand hover:border-brand"
            >
              {dict.home.viewAll}
              <Arrow className="size-4" aria-hidden />
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
