"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useRef, useState } from "react";
import { matchesName } from "@/lib/arabic";
import { inputClass } from "./form-controls";

type Option = { id: number; name: string };

/**
 * One box to find and choose an area: type part of the name and pick from the
 * list that opens under it (ه/ة, أ/ا… are treated alike). The chosen area's id
 * is sent in a hidden field.
 */
export function AreaCombobox({
  id,
  name,
  options,
  value,
  onChange,
  placeholder,
  noMatch,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  noMatch: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const selected = options.find((o) => String(o.id) === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = options.filter((o) => matchesName(o.name, query));

  function choose(option: Option) {
    onChange(String(option.id));
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          value={open ? query : (selected?.name ?? "")}
          placeholder={selected ? selected.name : placeholder}
          onFocus={() => {
            setQuery("");
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && shown[active]) {
              e.preventDefault();
              choose(shown[active]);
              inputRef.current?.blur();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={`${inputClass} ps-9 pe-9`}
        />
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{noMatch}</li>
          ) : (
            shown.map((option, i) => (
              <li
                key={option.id}
                role="option"
                aria-selected={String(option.id) === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${i === active ? "bg-brand-soft" : ""}`}
              >
                <span>{option.name}</span>
                {String(option.id) === value && <Check className="size-4 text-brand" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
