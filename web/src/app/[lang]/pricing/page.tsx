import { ArrowUp, BadgeCheck, Building2, Check, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOfficePlans } from "@/lib/data/offices";
import { getReferenceData } from "@/lib/data/public";
import { formatPrice, t } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/pricing">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.pricing.title,
    description: dict.pricing.intro,
    alternates: { canonical: localePath(lang, "/pricing"), languages: { ar: localePath("ar", "/pricing"), en: localePath("en", "/pricing") } },
  };
}

/** Public page that sells the paid services: featured, move to top, office packages and verification. */
export default async function PricingPage({ params }: PageProps<"/[lang]/pricing">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, ref, plans] = await Promise.all([getDictionary(lang), getReferenceData(), getOfficePlans()]);
  const p = dict.pricing;
  const price = (key: string) => formatPrice(Number(ref.settings[key] ?? 0), lang, dict.common.currency);
  const freeLimit = Number(ref.settings.max_active_listings_individual ?? 3);
  const box = "rounded-2xl border border-border bg-surface p-5";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-2xl font-extrabold">{p.title}</h1>
        <p className="mt-1 text-muted">{p.intro}</p>
      </header>

      <section className={box} aria-labelledby="free-heading">
        <h2 id="free-heading" className="text-lg font-extrabold">
          {p.freeTitle}
        </h2>
        <p className="mt-1">{t(p.freeText, { n: freeLimit })}</p>
      </section>

      <section className={box} aria-labelledby="promote-heading">
        <h2 id="promote-heading" className="mb-3 text-lg font-extrabold">
          {p.promoteTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-accent/40 bg-accent-soft/60 p-4">
            <p className="flex items-center gap-2 font-extrabold">
              <Star className="size-5 text-accent" aria-hidden />
              {p.featureName}
            </p>
            <p className="mt-1 text-sm">{p.featureText}</p>
            <ul className="mt-3 flex flex-col gap-1 text-sm font-semibold">
              <li>{p.days7}: {price("price_feature_7_days")}</li>
              <li>{p.days14}: {price("price_feature_14_days")}</li>
              <li>{p.days30}: {price("price_feature_30_days")}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 font-extrabold">
              <ArrowUp className="size-5 text-brand" aria-hidden />
              {p.bumpName}
            </p>
            <p className="mt-1 text-sm">{p.bumpText}</p>
            <p className="mt-3 text-sm font-semibold">
              {p.perTime}: {price("price_bump")}
            </p>
          </div>
        </div>
      </section>

      <section className={box} aria-labelledby="offices-heading">
        <h2 id="offices-heading" className="flex items-center gap-2 text-lg font-extrabold">
          <Building2 className="size-5" aria-hidden />
          {p.officesTitle}
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">{p.officesIntro}</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.slug} className="rounded-xl border border-border p-4">
              <p className="font-extrabold">{plan.name[lang]}</p>
              <p className="text-lg font-bold text-brand-strong">
                {formatPrice(plan.priceJod, lang, dict.common.currency)} <span className="text-sm font-normal text-muted">/ {dict.office.perMonth}</span>
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                <li className="flex gap-1.5">
                  <Check className="size-4 shrink-0 text-brand" aria-hidden />
                  {t(dict.office.planListings, { n: plan.maxActiveListings })}
                </li>
                {plan.featuredPerMonth > 0 && (
                  <li className="flex gap-1.5">
                    <Check className="size-4 shrink-0 text-brand" aria-hidden />
                    {t(dict.office.planFeatured, { n: plan.featuredPerMonth })}
                  </li>
                )}
                <li className="flex gap-1.5">
                  <Check className="size-4 shrink-0 text-brand" aria-hidden />
                  {p.officePage}
                </li>
                <li className="flex gap-1.5">
                  <Check className="size-4 shrink-0 text-brand" aria-hidden />
                  {plan.includesVerification ? dict.office.planVerificationIncluded : dict.office.planVerificationExtra}
                </li>
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className={box} id="verified" aria-labelledby="verified-heading">
        <h2 id="verified-heading" className="flex items-center gap-2 text-lg font-extrabold">
          <BadgeCheck className="size-5 text-brand" aria-hidden />
          {p.verifiedTitle}
        </h2>
        <p className="mt-1">{p.verifiedText}</p>
        <p className="mt-2 text-sm text-muted">{dict.office.badgeMeaning}</p>
      </section>

      <section className="rounded-2xl border border-brand/30 bg-brand-soft p-5" aria-labelledby="order-heading">
        <h2 id="order-heading" className="text-lg font-extrabold">
          {p.orderTitle}
        </h2>
        <ol className="mt-2 flex list-decimal flex-col gap-1 ps-5">
          <li>{p.order1}</li>
          <li>{p.order2}</li>
          <li>{p.order3}</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={localePath(lang, "/my/office")} className="rounded-lg bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong">
            {p.ctaOffice}
          </Link>
          <Link href={localePath(lang, "/contact")} className="rounded-lg border border-border bg-surface px-4 py-2 font-bold hover:border-brand">
            {p.ctaContact}
          </Link>
        </div>
      </section>
    </div>
  );
}
