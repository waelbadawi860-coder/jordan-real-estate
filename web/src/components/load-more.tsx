"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { loadMoreListings } from "@/app/actions/public";
import type { Locale } from "@/i18n/config";
import type { ListingCard as Card } from "@/lib/data/public";
import type { Cursor, SearchFilters } from "@/lib/search";
import { ListingCard, listingListClass, type CardLabels } from "./listing-card";

/** Appends the next page of results when the visitor asks for more. */
export function LoadMore({
  filters,
  initialCursor,
  locale,
  labels,
  text,
}: {
  filters: SearchFilters;
  initialCursor: Cursor | null;
  locale: Locale;
  labels: CardLabels;
  text: { loadMore: string; loading: string; loadError: string };
}) {
  const [items, setItems] = useState<Card[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function load() {
    if (!cursor) return;
    setFailed(false);
    startTransition(async () => {
      try {
        const page = await loadMoreListings(filters, cursor);
        setItems((prev) => [...prev, ...page.items]);
        setCursor(page.nextCursor);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <>
      {items.length > 0 && (
        <ul className={`mt-4 ${listingListClass}`}>
          {items.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} locale={locale} labels={labels} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-col items-center gap-2" aria-live="polite">
        {failed && <p className="text-sm text-danger">{text.loadError}</p>}
        {cursor && (
          <button
            type="button"
            onClick={load}
            disabled={pending}
            className="flex h-12 items-center gap-2 rounded-lg border-2 border-brand px-8 font-bold text-brand hover:bg-brand-soft disabled:opacity-60"
          >
            {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
            {pending ? text.loading : text.loadMore}
          </button>
        )}
      </div>
    </>
  );
}
