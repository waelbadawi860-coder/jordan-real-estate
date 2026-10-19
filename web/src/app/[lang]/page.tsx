import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cardLabels, ListingCard } from "@/components/listing-card";
import { SearchForm } from "@/components/search-form";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getReferenceData, searchListings } from "@/lib/data/public";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const [dict, ref, latest] = await Promise.all([
    getDictionary(lang),
    getReferenceData(),
    searchListings({ sort: "newest" }, null),
  ]);
  const labels = cardLabels(dict);
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;

  return (
    <>
      <section className="bg-brand-strong text-white">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:pt-12">
          <h1 className="text-2xl font-extrabold sm:text-4xl">{dict.search.heroTitle}</h1>
          <p className="mt-2 text-white/85 sm:text-lg">{dict.search.heroSubtitle}</p>
          <div className="mt-6 rounded-2xl bg-background p-4 text-foreground shadow-lg sm:p-5">
            <SearchForm locale={lang} dict={dict} refData={ref} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8" aria-labelledby="latest-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 id="latest-heading" className="text-xl font-extrabold sm:text-2xl">
            {dict.home.latest}
          </h2>
          {latest.items.length > 0 && (
            <Link href={localePath(lang, "/search")} className="flex items-center gap-1 font-bold text-brand hover:underline">
              {dict.home.viewAll}
              <Arrow className="size-4" aria-hidden />
            </Link>
          )}
        </div>

        {latest.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            {dict.home.empty}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.items.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} locale={lang} labels={labels} priority={index < 2} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4">
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-accent-soft p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold">{dict.home.postCta}</h2>
            <p className="text-muted">{dict.home.postCtaText}</p>
          </div>
          <Link
            href={localePath(lang, "/post")}
            className="flex h-12 items-center gap-2 rounded-lg bg-accent px-6 font-bold text-white hover:opacity-90"
          >
            <Plus className="size-5" aria-hidden />
            {dict.home.postCtaButton}
          </Link>
        </div>
      </section>
    </>
  );
}
