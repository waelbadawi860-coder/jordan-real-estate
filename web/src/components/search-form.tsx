"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AreaFacet, City, Neighborhood, PropertyType } from "@/lib/data/public";
import { FLOOR_LEVELS } from "@/lib/floor";
import { formatNumber, t } from "@/lib/format";
import type { SearchFilters } from "@/lib/search";

// A plain HTML form (method GET): every search has a shareable URL such as
// /search?deal=rent&type=apartment&city=amman&hood=abdoun.
//
// The lists are linked: the deal decides which property types are offered, the
// deal and type decide which cities and areas are offered (only those with
// matching ads, with their counts), and changing a choice clears any later
// choice that no longer fits.

const field =
  "h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground focus:border-brand focus:outline-none";
const label = "mb-1 block text-sm font-semibold text-foreground";

type Deal = "" | "sale" | "rent";

export function SearchForm({
  locale,
  dict,
  refData,
  facets,
  filters,
}: {
  locale: Locale;
  dict: Pick<Dictionary, "search" | "floors">;
  refData: { cities: City[]; neighborhoods: Neighborhood[]; propertyTypes: PropertyType[] };
  facets: AreaFacet[];
  filters?: Partial<SearchFilters>;
}) {
  const s = dict.search;
  const f = filters ?? {};

  const [deal, setDeal] = useState<Deal>(f.deal && f.deal !== "all" ? f.deal : "");
  const [typeSlug, setTypeSlug] = useState(f.type && f.type !== "all" ? f.type : "");
  const [citySlug, setCitySlug] = useState(f.city ?? "");
  const [hoodSlug, setHoodSlug] = useState(f.hood ?? "");

  const typesFor = (d: Deal) => refData.propertyTypes.filter((pt) => !d || pt.allowedDeals.includes(d));
  const typeBySlug = (slug: string) => refData.propertyTypes.find((pt) => pt.slug === slug);

  const count = (d: Deal, typeId: number | undefined, cityId?: number, hoodId?: number) =>
    facets.reduce(
      (sum, x) =>
        (!d || x.deal === d) &&
        (typeId === undefined || x.typeId === typeId) &&
        (cityId === undefined || x.cityId === cityId) &&
        (hoodId === undefined || x.hoodId === hoodId)
          ? sum + x.count
          : sum,
      0,
    );

  // Areas offered for a deal/type: those with matching ads, plus the current choice.
  const citiesFor = (d: Deal, typeId: number | undefined, keep: string) =>
    refData.cities.filter((c) => c.slug === keep || count(d, typeId, c.id) > 0);
  const hoodsFor = (d: Deal, typeId: number | undefined, cityId: number | undefined, keep: string) =>
    cityId === undefined
      ? []
      : refData.neighborhoods.filter((n) => n.cityId === cityId && (n.slug === keep || count(d, typeId, cityId, n.id) > 0));

  const type = typeBySlug(typeSlug);
  const city = refData.cities.find((c) => c.slug === citySlug);
  const types = typesFor(deal);
  const cities = citiesFor(deal, type?.id, citySlug);
  const hoods = hoodsFor(deal, type?.id, city?.id, hoodSlug);
  const showFloor = !type || type.hasFloor;
  const showBeds = !type || type.hasBedrooms;
  const showBaths = !type || type.hasBathrooms;
  const showFloorsCount = !type || type.hasFloorsCount;

  // Each change clears the later choices that no longer fit.
  function chooseDeal(d: Deal) {
    const nextType = typeBySlug(typeSlug) && typesFor(d).some((pt) => pt.slug === typeSlug) ? typeSlug : "";
    setDeal(d);
    setTypeSlug(nextType);
    keepArea(d, typeBySlug(nextType)?.id);
  }
  function chooseType(slug: string) {
    setTypeSlug(slug);
    keepArea(deal, typeBySlug(slug)?.id);
  }
  function keepArea(d: Deal, typeId: number | undefined) {
    const c = refData.cities.find((x) => x.slug === citySlug);
    const cityOk = c && count(d, typeId, c.id) > 0;
    if (!cityOk) {
      setCitySlug("");
      setHoodSlug("");
      return;
    }
    const h = refData.neighborhoods.find((x) => x.slug === hoodSlug && x.cityId === c.id);
    if (!h || count(d, typeId, c.id, h.id) === 0) setHoodSlug("");
  }
  function chooseCity(slug: string) {
    setCitySlug(slug);
    setHoodSlug("");
  }

  const withCount = (text: string, n: number) => `${text} (${formatNumber(n, locale)})`;

  return (
    <form action={localePath(locale, "/search")} method="get" role="search" className="flex flex-col gap-4">
      <fieldset className="flex gap-2">
        <legend className="mb-1 text-sm font-semibold">{s.deal}</legend>
        {(
          [
            ["", s.any],
            ["sale", s.sale],
            ["rent", s.rent],
          ] as const
        ).map(([value, text]) => (
          <label key={value} className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="deal"
              // "All" is sent as an explicit choice, so the tag board shows its next step.
              value={value || "all"}
              checked={deal === value}
              onChange={() => chooseDeal(value)}
              className="peer sr-only"
            />
            <span className="block rounded-lg border border-border bg-surface py-2.5 text-center font-bold text-muted transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-accent">
              {text}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <label htmlFor="sf-type" className={label}>
            {s.type}
          </label>
          <select
            id="sf-type"
            name="type"
            value={typeSlug || "all"}
            onChange={(e) => chooseType(e.target.value === "all" ? "" : e.target.value)}
            className={field}
          >
            <option value="all">{s.anyType}</option>
            {types.map((pt) => (
              <option key={pt.id} value={pt.slug}>
                {withCount(pt.name[locale], count(deal, pt.id))}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sf-city" className={label}>
            {s.city}
          </label>
          <select id="sf-city" name="city" value={citySlug} onChange={(e) => chooseCity(e.target.value)} className={field}>
            <option value="">{s.anyCity}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.slug}>
                {withCount(c.name[locale], count(deal, type?.id, c.id))}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sf-hood" className={label}>
            {s.neighborhood}
          </label>
          <select
            id="sf-hood"
            name="hood"
            value={hoodSlug}
            onChange={(e) => setHoodSlug(e.target.value)}
            disabled={!city}
            className={`${field} disabled:opacity-60`}
          >
            <option value="">{s.anyNeighborhood}</option>
            {city &&
              hoods.map((n) => (
                <option key={n.id} value={n.slug}>
                  {withCount(n.name[locale], count(deal, type?.id, city.id, n.id))}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="sf-q" className={label}>
            {s.keyword}
          </label>
          <input
            id="sf-q"
            name="q"
            type="search"
            maxLength={60}
            defaultValue={f.q ?? ""}
            placeholder={s.keywordPlaceholder}
            className={field}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <NumberField id="sf-min" name="min" text={s.minPrice} value={f.min} />
        <NumberField id="sf-max" name="max" text={s.maxPrice} value={f.max} />
        <NumberField id="sf-amin" name="amin" text={s.minArea} value={f.amin} />
        <NumberField id="sf-amax" name="amax" text={s.maxArea} value={f.amax} />
        {showBeds && (
          <div>
            <label htmlFor="sf-beds" className={label}>
              {s.bedrooms}
            </label>
            <select id="sf-beds" name="beds" defaultValue={f.beds ? String(f.beds) : ""} className={field}>
              <option value="">{s.anyBedrooms}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {t(s.bedroomsAtLeast, { n })}
                </option>
              ))}
            </select>
          </div>
        )}
        {showBaths && (
          <AtLeastSelect id="sf-baths" name="baths" text={s.bathrooms} anyText={s.anyBathrooms} value={f.baths} atLeast={s.bedroomsAtLeast} max={5} />
        )}
        {showFloorsCount && (
          <AtLeastSelect id="sf-floors" name="floors" text={s.floorsCount} anyText={s.anyFloorsCount} value={f.floors} atLeast={s.bedroomsAtLeast} max={6} />
        )}
        {showFloor && (
          <div>
            <label htmlFor="sf-floor" className={label}>
              {s.floor}
            </label>
            <select id="sf-floor" name="floor" defaultValue={f.floor ?? ""} className={field}>
              <option value="">{s.anyFloor}</option>
              {FLOOR_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {dict.floors[level]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="sf-sort" className={label}>
            {s.sort}
          </label>
          <select id="sf-sort" name="sort" defaultValue={f.sort ?? "newest"} className={field}>
            <option value="newest">{s.sortNewest}</option>
            <option value="price_asc">{s.sortPriceAsc}</option>
            <option value="price_desc">{s.sortPriceDesc}</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="vo" value="1" defaultChecked={f.vo === "1"} className="size-4 accent-brand" />
        {s.verifiedOnly}
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-lg font-bold text-white hover:bg-brand-strong sm:flex-none sm:px-10 lg:flex-1 lg:px-6"
        >
          <Search className="size-5" aria-hidden />
          {s.submit}
        </button>
        <a href={localePath(locale, "/search")} className="text-sm font-semibold text-muted underline hover:text-brand">
          {s.reset}
        </a>
      </div>
    </form>
  );
}

/** "Any" or "n+" choices, e.g. bathrooms 2+. */
function AtLeastSelect({
  id,
  name,
  text,
  anyText,
  value,
  atLeast,
  max,
}: {
  id: string;
  name: string;
  text: string;
  anyText: string;
  value?: number;
  atLeast: string;
  max: number;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <select id={id} name={name} defaultValue={value ? String(value) : ""} className={field}>
        <option value="">{anyText}</option>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {t(atLeast, { n })}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({ id, name, text, value }: { id: string; name: string; text: string; value?: number }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        step="any"
        dir="ltr"
        defaultValue={value ?? ""}
        className={field}
      />
    </div>
  );
}
