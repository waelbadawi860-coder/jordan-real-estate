import { Clock, ImageOff, MapPin, Star } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { ListingCard as Card } from "@/lib/data/public";
import { formatNumber, formatPrice, t } from "@/lib/format";
import { listingPath } from "@/lib/paths";
import { TimeAgo } from "./time-ago";

/** Text the card needs, passed in so this component also works in the browser. */
export type CardLabels = {
  sale: string;
  rent: string;
  currency: string;
  perMonth: string;
  perYear: string;
  areaValue: string;
  /** "{n} bed" templates. */
  bedrooms: string;
  bathrooms: string;
  noPhoto: string;
  featured: string;
};

/** Classes for the list that holds listing rows (one ad per line, like a classifieds board). */
export const listingListClass = "divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface";

export function ListingCard({
  listing,
  locale,
  labels,
  priority = false,
}: {
  listing: Card;
  locale: Locale;
  labels: CardLabels;
  priority?: boolean;
}) {
  const location = [listing.neighborhood?.[locale], listing.city[locale]].filter(Boolean).join(locale === "ar" ? "، " : ", ");
  const period = listing.rentPeriod === "monthly" ? labels.perMonth : listing.rentPeriod === "yearly" ? labels.perYear : null;
  const facts = [
    listing.areaSqm !== null && t(labels.areaValue, { n: formatNumber(listing.areaSqm, locale) }),
    listing.bedrooms !== null && t(labels.bedrooms, { n: formatNumber(listing.bedrooms, locale) }),
    listing.bathrooms !== null && t(labels.bathrooms, { n: formatNumber(listing.bathrooms, locale) }),
  ].filter(Boolean) as string[];

  return (
    <article
      className={`relative flex gap-3 p-3 transition hover:bg-brand-soft/50 sm:p-4 ${listing.featured ? "bg-accent-soft/60" : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {listing.featured && (
          <span className="flex w-fit items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
            <Star className="size-3" aria-hidden />
            {labels.featured}
          </span>
        )}
        <h3 className="line-clamp-2 text-base font-bold leading-snug sm:text-lg" dir="auto">
          {/* The link covers the whole row, so the row is one tap target. */}
          <Link
            href={listingPath(locale, listing.id, listing.title)}
            className="text-foreground after:absolute after:inset-0 hover:text-brand hover:underline"
          >
            {listing.title}
          </Link>
        </h3>
        <p className="text-sm">
          <span className="font-bold text-brand-strong">{formatPrice(listing.price, locale, labels.currency)}</span>
          {period && <span className="text-muted"> / {period}</span>}
          <span className="text-muted">
            {" · "}
            {listing.dealType === "sale" ? labels.sale : labels.rent}
            {" · "}
            {listing.type[locale]}
          </span>
        </p>
        {facts.length > 0 && <p className="text-sm text-muted">{facts.join(" · ")}</p>}
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted sm:text-sm">
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {location}
          </span>
          {listing.publishedAt && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <TimeAgo iso={listing.publishedAt} locale={locale} />
            </span>
          )}
        </p>
      </div>

      <div className="size-24 shrink-0 overflow-hidden rounded-md bg-brand-soft sm:size-28">
        {listing.imageUrl ? (
          // Photos are already compressed to WebP at upload time, so they are
          // served directly instead of through a paid image-resizing service.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            <ImageOff className="size-6" aria-hidden />
            <span className="sr-only">{labels.noPhoto}</span>
          </div>
        )}
      </div>
    </article>
  );
}

/** The paid "featured" block shown above a list of results. */
export function FeaturedList({
  listings,
  title,
  locale,
  labels,
}: {
  listings: Card[];
  title: string;
  locale: Locale;
  labels: CardLabels;
}) {
  if (listings.length === 0) return null;
  return (
    <section className="mb-3" aria-label={title}>
      <h2 className="mb-1 text-sm font-bold text-accent">{title}</h2>
      <ul className={listingListClass}>
        {listings.map((listing, index) => (
          <li key={listing.id}>
            <ListingCard listing={listing} locale={locale} labels={labels} priority={index < 2} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function cardLabels(dict: {
  search: { sale: string; rent: string };
  common: { currency: string };
  listing: { perMonth: string; perYear: string; areaValue: string; bedsValue: string; bathsValue: string; noPhoto: string; featured: string };
}): CardLabels {
  return {
    sale: dict.search.sale,
    rent: dict.search.rent,
    currency: dict.common.currency,
    perMonth: dict.listing.perMonth,
    perYear: dict.listing.perYear,
    areaValue: dict.listing.areaValue,
    bedrooms: dict.listing.bedsValue,
    bathrooms: dict.listing.bathsValue,
    noPhoto: dict.listing.noPhoto,
    featured: dict.listing.featured,
  };
}
