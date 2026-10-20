import { Search } from "lucide-react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ReferenceData } from "@/lib/data/public";
import { filtersToQuery, type SearchFilters } from "@/lib/search";

// The top of the home and search pages, in the style of a classifieds board:
// one search box, then rows of quick tags. Plain links and a GET form, so it
// works without JavaScript and every view has a shareable URL.

export function BoardSearch({ locale, dict, q }: { locale: Locale; dict: Dictionary; q?: string }) {
  return (
    <form action={localePath(locale, "/search")} method="get" role="search" className="flex gap-2">
      <label htmlFor="board-q" className="sr-only">
        {dict.search.keyword}
      </label>
      <input
        id="board-q"
        name="q"
        type="search"
        maxLength={60}
        defaultValue={q ?? ""}
        placeholder={dict.search.keywordPlaceholder}
        className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-base focus:border-brand focus:outline-none"
      />
      <button
        type="submit"
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-strong"
      >
        <Search className="size-5" aria-hidden />
        <span className="hidden sm:inline">{dict.search.submit}</span>
        <span className="sr-only sm:hidden">{dict.search.submit}</span>
      </button>
    </form>
  );
}

export function BoardTags({
  locale,
  dict,
  refData,
  filters = { sort: "newest" },
}: {
  locale: Locale;
  dict: Dictionary;
  refData: ReferenceData;
  filters?: SearchFilters;
}) {
  const s = dict.search;
  // Each tag changes one thing and keeps the rest of the current search.
  const href = (change: Partial<SearchFilters>) =>
    `${localePath(locale, "/search")}${filtersToQuery({ ...filters, ...change })}`;

  // Switching the deal drops a chosen type that doesn't exist for that deal.
  const typeFits = (deal: "sale" | "rent") =>
    refData.propertyTypes.find((type) => type.slug === filters.type)?.allowedDeals.includes(deal) ? filters.type : undefined;

  const dealTags = [
    { text: s.any, active: !filters.deal, href: href({ deal: undefined }) },
    { text: s.sale, active: filters.deal === "sale", href: href({ deal: "sale", type: typeFits("sale") }) },
    { text: s.rent, active: filters.deal === "rent", href: href({ deal: "rent", type: typeFits("rent") }) },
  ];
  // Only the types that can be listed for the chosen deal.
  const typeTags = refData.propertyTypes.filter((type) => !filters.deal || type.allowedDeals.includes(filters.deal)).map((type) => ({
    text: type.name[locale],
    active: filters.type === type.slug,
    href: href({ type: filters.type === type.slug ? undefined : type.slug }),
  }));
  const cityTags = refData.cities.map((city) => ({
    text: city.name[locale],
    active: filters.city === city.slug,
    href: href({ city: filters.city === city.slug ? undefined : city.slug, hood: undefined }),
  }));

  return (
    <div className="flex flex-col gap-2">
      <TagRow label={s.deal} tags={dealTags} />
      <TagRow label={s.type} tags={typeTags} />
      {cityTags.length > 1 && <TagRow label={s.city} tags={cityTags} />}
    </div>
  );
}

function TagRow({ label, tags }: { label: string; tags: { text: string; active: boolean; href: string }[] }) {
  return (
    <nav aria-label={label}>
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {tags.map((tag) => (
          <li key={tag.href + tag.text} className="shrink-0">
            <Link
              href={tag.href}
              aria-current={tag.active ? "page" : undefined}
              className={`block rounded-full border px-3 py-1 text-sm font-semibold ${
                tag.active
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-surface text-foreground hover:border-brand hover:text-brand"
              }`}
            >
              {tag.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
