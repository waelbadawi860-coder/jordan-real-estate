import { Search, SlidersHorizontal } from "lucide-react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ReferenceData } from "@/lib/data/public";
import { t } from "@/lib/format";
import type { SearchFilters } from "@/lib/search";

// A plain HTML form (method GET): works without JavaScript, and every search
// has a shareable URL such as /search?deal=rent&city=amman&hood=abdoun.

const field =
  "h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground focus:border-brand focus:outline-none";
const label = "mb-1 block text-sm font-semibold text-foreground";

export function SearchForm({
  locale,
  dict,
  refData,
  filters,
  advanced = false,
}: {
  locale: Locale;
  dict: Dictionary;
  refData: ReferenceData;
  filters?: Partial<SearchFilters>;
  advanced?: boolean;
}) {
  const s = dict.search;
  const f = filters ?? {};
  const hasAdvanced =
    f.min !== undefined || f.max !== undefined || f.amin !== undefined || f.amax !== undefined || f.beds !== undefined;

  return (
    <form action={localePath(locale, "/search")} method="get" role="search" className="flex flex-col gap-4">
      <fieldset className="flex gap-2">
        <legend className="sr-only">{s.deal}</legend>
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
              value={value}
              defaultChecked={(f.deal ?? "") === value}
              className="peer sr-only"
            />
            <span className="block rounded-lg border border-border bg-surface py-2.5 text-center font-bold text-muted transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-accent">
              {text}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="sf-city" className={label}>
            {s.city}
          </label>
          <select id="sf-city" name="city" defaultValue={f.city ?? ""} className={field}>
            <option value="">{s.anyCity}</option>
            {refData.cities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name[locale]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sf-hood" className={label}>
            {s.neighborhood}
          </label>
          <select id="sf-hood" name="hood" defaultValue={f.hood ?? ""} className={field}>
            <option value="">{s.anyNeighborhood}</option>
            {refData.cities.map((city) => {
              const hoods = refData.neighborhoods.filter((n) => n.cityId === city.id);
              if (hoods.length === 0) return null;
              return (
                <optgroup key={city.id} label={city.name[locale]}>
                  {hoods.map((n) => (
                    <option key={n.id} value={n.slug}>
                      {n.name[locale]}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div>
          <label htmlFor="sf-type" className={label}>
            {s.type}
          </label>
          <select id="sf-type" name="type" defaultValue={f.type ?? ""} className={field}>
            <option value="">{s.anyType}</option>
            {refData.propertyTypes.map((type) => (
              <option key={type.id} value={type.slug}>
                {type.name[locale]}
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

      {advanced && (
        <details open={hasAdvanced} className="rounded-lg border border-border bg-surface p-3">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-brand">
            <SlidersHorizontal className="size-4" aria-hidden />
            {s.moreFilters}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField id="sf-min" name="min" text={s.minPrice} value={f.min} />
            <NumberField id="sf-max" name="max" text={s.maxPrice} value={f.max} />
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
            <NumberField id="sf-amin" name="amin" text={s.minArea} value={f.amin} />
            <NumberField id="sf-amax" name="amax" text={s.maxArea} value={f.amax} />
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
        </details>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-lg font-bold text-white hover:bg-brand-strong sm:flex-none sm:px-10"
        >
          <Search className="size-5" aria-hidden />
          {s.submit}
        </button>
        {advanced && (
          <a href={localePath(locale, "/search")} className="text-sm font-semibold text-muted underline hover:text-brand">
            {s.reset}
          </a>
        )}
      </div>
    </form>
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
