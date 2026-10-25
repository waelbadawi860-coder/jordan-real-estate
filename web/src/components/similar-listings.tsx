import { ImageOff, MapPin } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { ListingCard } from "@/lib/data/public";
import { formatPrice } from "@/lib/format";
import { listingPath } from "@/lib/paths";

/** "Similar listings" under a listing: photo cards with title, price and area. */
export function SimilarListings({
  listings,
  locale,
  title,
  currency,
  perMonth,
  noPhoto,
  action,
}: {
  listings: ListingCard[];
  locale: Locale;
  title: string;
  currency: string;
  perMonth: string;
  noPhoto: string;
  /** The "follow similar listings" button. */
  action: ReactNode;
}) {
  return (
    <section className="mx-auto mt-6 max-w-3xl px-4" aria-labelledby="similar-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="similar-heading" className="text-lg font-extrabold">
          {title}
        </h2>
        {action}
      </div>
      {listings.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {listings.map((l) => (
            <li key={l.id}>
              <Link
                href={listingPath(locale, l.id, l.title)}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface hover:border-brand"
              >
                <div className="aspect-[4/3] bg-brand-soft">
                  {l.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.imageUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted">
                      <ImageOff className="size-6" aria-hidden />
                      <span className="sr-only">{noPhoto}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2">
                  <p className="line-clamp-2 text-sm font-bold leading-snug" dir="auto">
                    {l.title}
                  </p>
                  <p className="mt-auto text-sm font-bold text-brand-strong">
                    {formatPrice(l.price, locale, currency)}
                    {l.rentPeriod === "monthly" && <span className="font-normal text-muted"> / {perMonth}</span>}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{l.neighborhood?.[locale] ?? l.city[locale]}</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
