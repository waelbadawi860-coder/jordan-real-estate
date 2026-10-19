import { BedDouble, Bath, ImageOff, MapPin, Ruler } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { ListingCard as Card } from "@/lib/data/public";
import { formatNumber, formatPrice, t } from "@/lib/format";
import { listingPath } from "@/lib/paths";

/** Text the card needs, passed in so this component also works in the browser. */
export type CardLabels = {
  sale: string;
  rent: string;
  currency: string;
  perMonth: string;
  perYear: string;
  areaValue: string;
  bedrooms: string;
  bathrooms: string;
  noPhoto: string;
};

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

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:shadow-md">
      <Link href={listingPath(locale, listing.id, listing.title)} className="block focus-visible:outline-offset-[-3px]">
        <div className="relative aspect-[4/3] bg-brand-soft">
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
              className="size-full object-cover transition group-hover:scale-[1.02]"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted">
              <ImageOff className="size-8" aria-hidden />
              <span className="sr-only">{labels.noPhoto}</span>
            </div>
          )}
          <span
            className={`absolute start-2 top-2 rounded-md px-2 py-0.5 text-xs font-bold text-white ${
              listing.dealType === "sale" ? "bg-brand" : "bg-accent"
            }`}
          >
            {listing.dealType === "sale" ? labels.sale : labels.rent}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 p-3">
          <p className="text-lg font-extrabold text-brand-strong">
            {formatPrice(listing.price, locale, labels.currency)}
            {period && <span className="ms-1 text-sm font-semibold text-muted">/ {period}</span>}
          </p>
          <h3 className="line-clamp-2 font-bold leading-snug text-foreground" dir="auto">
            {listing.title}
          </h3>
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              {listing.type[locale]} · {location}
            </span>
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {listing.areaSqm !== null && (
              <li className="flex items-center gap-1">
                <Ruler className="size-4" aria-hidden />
                {t(labels.areaValue, { n: formatNumber(listing.areaSqm, locale) })}
              </li>
            )}
            {listing.bedrooms !== null && (
              <li className="flex items-center gap-1">
                <BedDouble className="size-4" aria-hidden />
                <span className="sr-only">{labels.bedrooms}:</span>
                {formatNumber(listing.bedrooms, locale)}
              </li>
            )}
            {listing.bathrooms !== null && (
              <li className="flex items-center gap-1">
                <Bath className="size-4" aria-hidden />
                <span className="sr-only">{labels.bathrooms}:</span>
                {formatNumber(listing.bathrooms, locale)}
              </li>
            )}
          </ul>
        </div>
      </Link>
    </article>
  );
}

export function cardLabels(dict: {
  search: { sale: string; rent: string };
  common: { currency: string };
  listing: { perMonth: string; perYear: string; areaValue: string; bedrooms: string; bathrooms: string; noPhoto: string };
}): CardLabels {
  return {
    sale: dict.search.sale,
    rent: dict.search.rent,
    currency: dict.common.currency,
    perMonth: dict.listing.perMonth,
    perYear: dict.listing.perYear,
    areaValue: dict.listing.areaValue,
    bedrooms: dict.listing.bedrooms,
    bathrooms: dict.listing.bathrooms,
    noPhoto: dict.listing.noPhoto,
  };
}
