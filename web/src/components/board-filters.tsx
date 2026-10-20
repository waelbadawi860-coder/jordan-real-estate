import { Search } from "lucide-react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AreaFacet, ReferenceData } from "@/lib/data/public";
import { formatNumber } from "@/lib/format";
import { ScrollActiveArea } from "./scroll-active-area";
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
  facets = [],
}: {
  locale: Locale;
  dict: Dictionary;
  refData: ReferenceData;
  filters?: SearchFilters;
  /** Ad counts per area, shown next to each area's name. */
  facets?: AreaFacet[];
}) {
  const s = dict.search;
  // Each tag changes one thing and keeps the rest of the current search.
  const href = (change: Partial<SearchFilters>) =>
    `${localePath(locale, "/search")}${filtersToQuery({ ...filters, ...change })}`;

  // Step by step: deal → property type → city → area. Each row appears once
  // the previous choice is made ("All" counts as a choice).
  const deal = filters.deal && filters.deal !== "all" ? filters.deal : undefined;
  const dealChosen = filters.deal !== undefined;
  const typeChosen = dealChosen && filters.type !== undefined;
  const city = typeChosen ? refData.cities.find((c) => c.slug === filters.city) : undefined;

  // Switching the deal drops a chosen type that doesn't exist for that deal
  // (and with it the later steps).
  const afterDeal = (next: "sale" | "rent" | "all"): Partial<SearchFilters> => {
    const type = refData.propertyTypes.find((t) => t.slug === filters.type);
    const keepType = filters.type === "all" || (type && (next === "all" || type.allowedDeals.includes(next)));
    return keepType ? { deal: next } : { deal: next, type: undefined, city: undefined, hood: undefined };
  };
  const dealTags = (["all", "sale", "rent"] as const).map((value) => ({
    text: value === "all" ? s.any : value === "sale" ? s.sale : s.rent,
    active: filters.deal === value,
    href: href(afterDeal(value)),
  }));

  // Only the types that can be listed for the chosen deal, after an "All" tag.
  const typeTags = [
    { text: s.any, active: filters.type === "all", href: href({ type: "all" }) },
    ...refData.propertyTypes
      .filter((type) => !deal || type.allowedDeals.includes(deal))
      .map((type) => ({ text: type.name[locale], active: filters.type === type.slug, href: href({ type: type.slug }) })),
  ];

  const cityTags = refData.cities.map((c) => ({
    text: c.name[locale],
    active: filters.city === c.slug,
    href: href({ city: filters.city === c.slug ? undefined : c.slug, hood: undefined }),
  }));

  // The chosen city's areas: own colour, one alphabetical line, with ad counts.
  const typeId = refData.propertyTypes.find((t) => t.slug === filters.type)?.id;
  const count = (hoodId: number) =>
    facets.reduce(
      (sum, f) =>
        f.hoodId === hoodId && (!deal || f.deal === deal) && (typeId === undefined || f.typeId === typeId) ? sum + f.count : sum,
      0,
    );
  const collator = new Intl.Collator(locale === "ar" ? "ar" : "en");
  const hoodTags = city
    ? [
        { text: s.anyNeighborhood, active: !filters.hood, href: href({ hood: undefined }) },
        ...refData.neighborhoods
          .filter((n) => n.cityId === city.id)
          .sort((a, b) => collator.compare(a.name[locale], b.name[locale]))
          .map((n) => {
            const ads = count(n.id);
            return {
              text: ads > 0 ? `${n.name[locale]} (${formatNumber(ads, locale)})` : n.name[locale],
              active: filters.hood === n.slug,
              href: href({ hood: filters.hood === n.slug ? undefined : n.slug }),
            };
          }),
      ]
    : [];

  return (
    <div className="flex flex-col gap-2">
      <TagRow label={s.deal} tags={dealTags} />
      {dealChosen && <TagRow label={s.type} tags={typeTags} variant="type" />}
      {typeChosen && <TagRow label={s.city} tags={cityTags} variant="city" />}
      {hoodTags.length > 1 && (
        <>
          <TagRow label={s.neighborhood} tags={hoodTags} variant="area" />
        </>
      )}
      {(filters.hood || filters.city || (filters.type && filters.type !== "all")) && <ScrollActiveArea />}
    </div>
  );
}

// Colours per row: deal (main, green), types (blue), governorates (slate), areas (brown).
const rowStyles = {
  type: {
    scroll: "type-scroll",
    on: "border-types bg-types text-white",
    off: "border-types/30 bg-types-soft text-foreground hover:border-types hover:text-types",
  },
  city: {
    scroll: "city-scroll",
    on: "border-cities bg-cities text-white",
    off: "border-cities/30 bg-cities-soft text-foreground hover:border-cities hover:text-cities",
  },
  area: {
    scroll: "area-scroll",
    on: "border-accent bg-accent text-white",
    off: "border-accent/30 bg-accent-soft text-foreground hover:border-accent hover:text-accent",
  },
} as const;

function TagRow({
  label,
  tags,
  variant = "main",
}: {
  label: string;
  tags: { text: string; active: boolean; href: string }[];
  /** Every row but the first has its own colour, stays on one line and has a visible scroll bar underneath. */
  variant?: "main" | keyof typeof rowStyles;
}) {
  const style = variant === "main" ? null : rowStyles[variant];
  return (
    <nav aria-label={label}>
      <ul
        className={
          style
            ? `${style.scroll} -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0`
            : "no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        }
      >
        {tags.map((tag) => (
          <li key={tag.href + tag.text} className="shrink-0">
            <Link
              href={tag.href}
              aria-current={tag.active ? "page" : undefined}
              className={`block whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold ${
                style
                  ? tag.active
                    ? style.on
                    : style.off
                  : tag.active
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
