import { Bath, BedDouble, Building2, Flag, MapPin, Ruler, ShieldCheck, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ContactPanel } from "@/components/contact-panel";
import { listingPath } from "@/lib/paths";
import { ShareButton } from "@/components/share-button";
import { hasLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getListing, getReferenceData, siteName, type ListingDetail } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";
import { formatDate, formatNumber, formatPrice, slugify, t } from "@/lib/format";

type Props = PageProps<"/[lang]/property/[id]/[[...slug]]">;

function parseId(raw: string): number | null {
  return /^[0-9]{1,15}$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id: rawId } = await params;
  const id = parseId(rawId);
  if (!hasLocale(lang) || id === null) return {};

  const [dict, listing, ref] = await Promise.all([getDictionary(lang), getListing(id), getReferenceData()]);
  if (!listing) return { title: dict.listing.notFoundTitle, robots: { index: false } };

  const deal = listing.dealType === "sale" ? dict.search.sale : dict.search.rent;
  const where = [listing.neighborhood?.[lang], listing.city[lang]].filter(Boolean).join(lang === "ar" ? "، " : ", ");
  const price = formatPrice(listing.price, lang, dict.common.currency);
  const description = `${listing.type[lang]} ${deal} — ${where} — ${price}`;
  const path = listingPath(lang, listing.id, listing.title);
  const image = listing.images[0];

  return {
    title: `${listing.title} — ${price}`,
    description,
    alternates: {
      canonical: path,
      languages: { ar: listingPath("ar", listing.id, listing.title), en: listingPath("en", listing.id, listing.title) },
    },
    openGraph: {
      type: "article",
      url: path,
      siteName: siteName(ref, lang),
      title: `${listing.title} — ${price}`,
      description,
      images: image ? [{ url: image.url, width: image.width ?? undefined, height: image.height ?? undefined }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}

// The listing is looked up BEFORE anything is sent, so a missing, sold or
// expired listing returns a real 404 status and outdated links a real 308
// redirect. Search engines then drop old listings instead of indexing them.
// Lookups are cached for a few minutes, so this stays fast.
export const instant = false;

export default async function PropertyPage({ params }: Props) {
  const { lang, id: rawId, slug } = await params;
  const id = parseId(rawId);
  if (!hasLocale(lang) || id === null) notFound();

  const [dict, listing, ref] = await Promise.all([getDictionary(lang), getListing(id), getReferenceData()]);
  if (!listing) notFound();

  // One address per listing: fix outdated or missing title slugs.
  const expectedSlug = slugify(listing.title);
  const givenSlug = slug?.[0] ? decodeURIComponent(slug[0]) : "";
  if (expectedSlug && givenSlug !== expectedSlug) permanentRedirect(listingPath(lang, listing.id, listing.title));

  const site = siteName(ref, lang);
  // Short form (no title) so the link survives copy/paste in any messaging app.
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}${localePath(lang, `/property/${listing.id}`)}`;

  return <PropertyView listing={listing} locale={lang} dict={dict} site={site} url={url} />;
}

function PropertyView({
  listing,
  locale,
  dict,
  site,
  url,
}: {
  listing: ListingDetail;
  locale: Locale;
  dict: Dictionary;
  site: string;
  url: string;
}) {
  const d = dict.listing;
  const where = [listing.neighborhood?.[locale], listing.city[locale]].filter(Boolean).join(locale === "ar" ? "، " : ", ");
  const period = listing.rentPeriod === "monthly" ? d.perMonth : listing.rentPeriod === "yearly" ? d.perYear : null;

  const facts = [
    { icon: Building2, label: d.type, value: listing.type[locale] },
    { icon: Tag, label: d.deal, value: listing.dealType === "sale" ? dict.search.sale : dict.search.rent },
    listing.areaSqm !== null && {
      icon: Ruler,
      label: d.area,
      value: t(d.areaValue, { n: formatNumber(listing.areaSqm, locale) }),
    },
    listing.bedrooms !== null && { icon: BedDouble, label: d.bedrooms, value: formatNumber(listing.bedrooms, locale) },
    listing.bathrooms !== null && { icon: Bath, label: d.bathrooms, value: formatNumber(listing.bathrooms, locale) },
  ].filter(Boolean) as { icon: typeof Ruler; label: string; value: string }[];

  return (
    <article className="mx-auto max-w-6xl px-4 py-6">
      <nav className="mb-3 text-sm">
        <Link href={localePath(locale, "/search")} className="font-semibold text-brand hover:underline">
          {d.backToResults}
        </Link>
      </nav>

      <Gallery listing={listing} dict={dict} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <span
              className={`w-fit rounded-md px-2 py-0.5 text-sm font-bold text-white ${
                listing.dealType === "sale" ? "bg-brand" : "bg-accent"
              }`}
            >
              {listing.dealType === "sale" ? dict.search.sale : dict.search.rent}
            </span>
            <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl" dir="auto">
              {listing.title}
            </h1>
            <p className="flex items-center gap-1 text-muted">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {where}
            </p>
            <p className="text-3xl font-extrabold text-brand-strong">
              {formatPrice(listing.price, locale, dict.common.currency)}
              {period && <span className="ms-2 text-base font-semibold text-muted">/ {period}</span>}
            </p>
          </header>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-border bg-surface p-3">
                <dt className="flex items-center gap-1 text-sm text-muted">
                  <Icon className="size-4" aria-hidden />
                  {label}
                </dt>
                <dd className="mt-1 font-bold">{value}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="mb-2 text-lg font-extrabold">
              {d.description}
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-foreground" dir="auto">
              {listing.description.trim() || d.noDescription}
            </p>
          </section>

          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <div className="flex gap-1">
              <dt>{d.id}:</dt>
              <dd className="font-semibold text-foreground" dir="ltr">
                {listing.id}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{d.published}:</dt>
              <dd>{formatDate(listing.publishedAt, locale)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{d.updated}:</dt>
              <dd>{formatDate(listing.updatedAt, locale)}</dd>
            </div>
          </dl>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="mb-1 text-lg font-extrabold">
              {d.contact}
            </h2>
            {listing.seller && (
              <p className="mb-3 text-sm text-muted">
                <span className="font-bold text-foreground">{listing.seller.displayName}</span>
                {" · "}
                {listing.posterType === "agent" ? d.agent : d.owner}
                {" · "}
                {t(d.memberSince, { date: formatDate(listing.seller.memberSince, locale) })}
              </p>
            )}
            <ContactPanel
              listingId={listing.id}
              whatsappMessage={t(d.whatsappMessage, { site, url })}
              text={{
                showNumber: d.showNumber,
                call: d.call,
                whatsapp: d.whatsapp,
                contactLimited: d.contactLimited,
                contactUnavailable: d.contactUnavailable,
                contactError: d.contactError,
                loading: dict.search.loading,
              }}
            />
            <p className="mt-2 text-xs text-muted">{d.contactPrivacy}</p>
          </section>

          <p className="flex gap-2 rounded-xl bg-accent-soft p-3 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-accent" aria-hidden />
            {d.safetyTip}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <ShareButton title={listing.title} label={d.share} copiedLabel={d.linkCopied} />
            <Link
              href={`${localePath(locale, "/contact")}?listing=${listing.id}`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-danger"
            >
              <Flag className="size-4" aria-hidden />
              {d.report}
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Gallery({ listing, dict }: { listing: ListingDetail; dict: Dictionary }) {
  const images = listing.images;
  if (images.length === 0) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-brand-soft text-muted">{dict.listing.noPhoto}</div>
    );
  }
  return (
    <section aria-label={dict.listing.photos}>
      <ul className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl">
        {images.map((image, index) => (
          <li key={image.url} className="w-full shrink-0 snap-center sm:w-[80%] lg:w-[65%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={t(dict.listing.photoOf, { n: index + 1, total: images.length })}
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding="async"
              className="aspect-[4/3] max-h-[460px] w-full rounded-2xl bg-brand-soft object-cover"
            />
          </li>
        ))}
      </ul>
      {images.length > 1 && (
        <p className="mt-1 text-center text-sm text-muted">
          {dict.listing.photos}: {images.length}
        </p>
      )}
    </section>
  );
}
