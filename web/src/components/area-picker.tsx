"use client";

import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { matchesName } from "@/lib/arabic";

/** countText: the number of ads, already formatted ("" when none). */
export type AreaLink = { name: string; countText: string; href: string; active: boolean };

/**
 * Every area of the chosen governorate, behind a "more areas" button, with a
 * search box on top. A plain <details> element, so it still opens (without
 * the search box filtering) when JavaScript is off.
 */
export function AreaPicker({
  areas,
  text,
}: {
  areas: AreaLink[];
  text: { more: string; find: string; none: string };
}) {
  const [query, setQuery] = useState("");
  const shown = areas.filter((a) => matchesName(a.name, query));

  return (
    <details className="group rounded-lg border border-accent/30 bg-surface open:p-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent group-open:mb-3 [&::-webkit-details-marker]:hidden">
        <Search className="size-4" aria-hidden />
        {text.more}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <label className="sr-only" htmlFor="area-find">
        {text.find}
      </label>
      <input
        id="area-find"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={text.find}
        autoComplete="off"
        className="mb-3 h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus:border-accent focus:outline-none"
      />
      {shown.length === 0 ? (
        <p className="py-2 text-sm text-muted">{text.none}</p>
      ) : (
        <ul className="grid max-h-80 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={a.active ? "page" : undefined}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm ${
                  a.active ? "bg-accent font-bold text-white" : "hover:bg-accent-soft"
                }`}
              >
                <span>{a.name}</span>
                {a.countText && <span className={a.active ? "text-white" : "text-muted"}>{a.countText}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
