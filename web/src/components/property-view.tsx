import { Clock, MapPin, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LocalizedName } from "@/lib/data/public";
import type { FloorLevel } from "@/lib/floor";
import { formatDate, formatNumber, formatPrice, t } from "@/lib/format";
import { ApproxMap } from "./map/approx-map";
import { TimeAgo } from "./time-ago";

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
  floorsCount: number | null;
  floor: FloorLevel | null;
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
    { label: d.type, value: listing.type[locale] },
    { label: d.deal, value: listing.dealType === "sale" ? dict.search.sale : dict.search.rent },
    listing.areaSqm !== null && { label: d.area, value: t(d.areaValue, { n: formatNumber(listing.areaSqm, locale) }) },
    listing.bedrooms !== null && { label: d.bedrooms, value: formatNumber(listing.bedrooms, locale) },
    listing.bathrooms !== null && { label: d.bathrooms, value: formatNumber(listing.bathrooms, locale) },
    listing.floorsCount !== null && { label: d.floorsCount, value: formatNumber(listing.floorsCount, locale) },
    listing.floor !== null && { label: d.floor, value: dict.floors[listing.floor] },
    listing.furnished !== null && { label: d.furnished, value: listing.furnished ? dict.form.yes : dict.form.no },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <article className="mx-auto max-w-4xl px-4 py-4">
      {back && (
        <nav className="mb-3 text-sm">
          <Link href={back.href} className="font-semibold text-brand hover:underline">
            {back.label}
          </Link>
        </nav>
      )}

      {/* Classifieds-board layout: the text of the ad first, photos underneath. */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-extrabold leading-snug sm:text-2xl" dir="auto">
            {listing.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {listing.seller && (
              <span className="flex items-center gap-1">
                <UserRound className="size-4 shrink-0" aria-hidden />
                <span className="font-bold text-foreground">{listing.seller.displayName}</span>
                <span>({listing.posterType === "agent" ? d.agent : d.owner})</span>
              </span>
            )}
            {listing.publishedAt && (
              <span className="flex items-center gap-1">
                <Clock className="size-4 shrink-0" aria-hidden />
                <TimeAgo iso={listing.publishedAt} locale={locale} />
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {where}
            </span>
          </p>
          <p className="text-2xl font-extrabold text-brand-strong">
            {formatPrice(listing.price, locale, dict.common.currency)}
            {period && <span className="ms-2 text-base font-semibold text-muted">/ {period}</span>}
          </p>
        </header>

        <section className="rounded-lg bg-brand-soft/60 p-3" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="mb-2 font-extrabold">
            {d.contact}
          </h2>
          {contact}
          <p className="mt-2 text-xs text-muted">{d.contactPrivacy}</p>
        </section>

        <p className="rounded-lg border border-border p-3 text-sm text-muted">{d.disclaimer}</p>

        <section aria-labelledby="desc-heading">
          <h2 id="desc-heading" className="sr-only">
            {d.description}
          </h2>
          <p className="whitespace-pre-line text-base leading-relaxed text-foreground sm:text-lg" dir="auto">
            {listing.description.trim() || d.noDescription}
          </p>
        </section>

        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border text-sm sm:grid-cols-3">
          {facts.map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-2 border-b border-e border-border px-3 py-2">
              <dt className="text-muted">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
        </dl>

        <Gallery images={listing.images} dict={dict} />

        {listing.approxLocation && (
          <ApproxMap
            lat={listing.approxLocation.lat}
            lng={listing.approxLocation.lng}
            text={{ showMap: dict.map.showMap, approxNote: dict.map.approxNote, loading: dict.map.loading }}
          />
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-sm text-muted">
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
          {listing.seller && (
            <div className="flex gap-1">
              <dd>{t(d.memberSince, { date: formatDate(listing.seller.memberSince, locale) })}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <p className="flex gap-2 rounded-lg bg-accent-soft p-3 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-accent" aria-hidden />
          {d.safetyTip}
        </p>
        {footer}
      </div>
    </article>
  );
}

function Gallery({ images, dict }: { images: PropertyViewData["images"]; dict: Dictionary }) {
  if (images.length === 0) return null;
  // Photos one under the other at full width, as on classifieds boards.
  return (
    <section aria-label={dict.listing.photos}>
      <ul className="flex flex-col gap-3">
        {images.map((image, index) => (
          <li key={image.url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={t(dict.listing.photoOf, { n: index + 1, total: images.length })}
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding="async"
              // Space is reserved before the photo loads, so the page doesn't jump.
              style={{ aspectRatio: image.width && image.height ? `${image.width} / ${image.height}` : "4 / 3" }}
              className="h-auto w-full rounded-lg bg-brand-soft object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
