import { Bath, BedDouble, Building2, Layers, MapPin, Ruler, ShieldCheck, Sofa, Tag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LocalizedName } from "@/lib/data/public";
import { formatDate, formatNumber, formatPrice, t } from "@/lib/format";
import { ApproxMap } from "./map/approx-map";

/** Everything needed to show a listing — used by the public page and the seller's preview. */
export type PropertyViewData = {
  id: number;
  title: string;
  description: string;
  price: number;
  dealType: "sale" | "rent";
  rentPeriod: "monthly" | "yearly" | null;
  type: LocalizedName;
  city: LocalizedName;
  neighborhood: LocalizedName | null;
  areaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  furnished: boolean | null;
  posterType: "owner" | "agent";
  publishedAt: string | null;
  updatedAt: string;
  images: { url: string; width: number | null; height: number | null }[];
  seller: { displayName: string; memberSince: string } | null;
  /** Rounded (≈1 km) public position, if the seller set a pin. */
  approxLocation?: { lat: number; lng: number } | null;
};

export function PropertyView({
  listing,
  locale,
  dict,
  back,
  contact,
  footer,
}: {
  listing: PropertyViewData;
  locale: Locale;
  dict: Dictionary;
  back?: { href: string; label: string };
  contact: ReactNode;
  footer?: ReactNode;
}) {
  const d = dict.listing;
  const where = [listing.neighborhood?.[locale], listing.city[locale]].filter(Boolean).join(locale === "ar" ? "، " : ", ");
  const period = listing.rentPeriod === "monthly" ? d.perMonth : listing.rentPeriod === "yearly" ? d.perYear : null;

  const facts = [
    { icon: Building2, label: d.type, value: listing.type[locale] },
    { icon: Tag, label: d.deal, value: listing.dealType === "sale" ? dict.search.sale : dict.search.rent },
    listing.areaSqm !== null && { icon: Ruler, label: d.area, value: t(d.areaValue, { n: formatNumber(listing.areaSqm, locale) }) },
    listing.bedrooms !== null && { icon: BedDouble, label: d.bedrooms, value: formatNumber(listing.bedrooms, locale) },
    listing.bathrooms !== null && { icon: Bath, label: d.bathrooms, value: formatNumber(listing.bathrooms, locale) },
    listing.floor !== null && { icon: Layers, label: d.floor, value: formatNumber(listing.floor, locale) },
    listing.furnished !== null && { icon: Sofa, label: d.furnished, value: listing.furnished ? dict.form.yes : dict.form.no },
  ].filter(Boolean) as { icon: typeof Ruler; label: string; value: string }[];

  return (
    <article className="mx-auto max-w-6xl px-4 py-6">
      {back && (
        <nav className="mb-3 text-sm">
          <Link href={back.href} className="font-semibold text-brand hover:underline">
            {back.label}
          </Link>
        </nav>
      )}

      <Gallery images={listing.images} dict={dict} />

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

          {listing.approxLocation && (
            <ApproxMap
              lat={listing.approxLocation.lat}
              lng={listing.approxLocation.lng}
              text={{ showMap: dict.map.showMap, approxNote: dict.map.approxNote, loading: dict.map.loading }}
            />
          )}

          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <div className="flex gap-1">
              <dt>{d.id}:</dt>
              <dd className="font-semibold text-foreground" dir="ltr">
                {listing.id}
              </dd>
            </div>
            {listing.publishedAt && (
              <div className="flex gap-1">
                <dt>{d.published}:</dt>
                <dd>{formatDate(listing.publishedAt, locale)}</dd>
              </div>
            )}
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
            {contact}
            <p className="mt-2 text-xs text-muted">{d.contactPrivacy}</p>
          </section>

          <p className="flex gap-2 rounded-xl bg-accent-soft p-3 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-accent" aria-hidden />
            {d.safetyTip}
          </p>

          {footer}
        </aside>
      </div>
    </article>
  );
}

function Gallery({ images, dict }: { images: PropertyViewData["images"]; dict: Dictionary }) {
  if (images.length === 0) {
    return <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-brand-soft text-muted">{dict.listing.noPhoto}</div>;
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
