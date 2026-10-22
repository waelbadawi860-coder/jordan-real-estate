"use client";

import { CheckCircle2, ExternalLink, MapPin } from "lucide-react";
import { useState, useTransition } from "react";
import { resolveMapLinkAction } from "@/app/actions/location";
import { googleMapsUrl, inJordan, isShortMapLink, parseLocation, type LatLng } from "@/lib/geo";
import { inputClass } from "./form-controls";

type Text = {
  label: string;
  optional: string;
  placeholder: string;
  hint: string;
  found: string;
  check: string;
  checking: string;
  open: string;
  clear: string;
  errors: { notFound: string; outsideJordan: string; tooMany: string; signIn: string };
};

/**
 * Optional position of the property: the seller pastes a Google Maps link or
 * coordinates. The exact position stays private; visitors only see a rounded
 * area (about 1 km).
 */
export function LocationInput({ initialLat, initialLng, text }: { initialLat: string; initialLng: string; text: Text }) {
  const initial = initialLat && initialLng ? { lat: Number(initialLat), lng: Number(initialLng) } : null;
  const [value, setValue] = useState(initial ? `${initial.lat}, ${initial.lng}` : "");
  const [position, setPosition] = useState<LatLng | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function read(input: string) {
    setValue(input);
    setError(null);
    if (!input.trim()) return setPosition(null);
    if (isShortMapLink(input)) return setPosition(null); // needs the "check" button
    const found = parseLocation(input);
    if (!found) {
      setPosition(null);
      return setError(text.errors.notFound);
    }
    if (!inJordan(found)) {
      setPosition(null);
      return setError(text.errors.outsideJordan);
    }
    setPosition(found);
  }

  function resolveShortLink() {
    startTransition(async () => {
      const result = await resolveMapLinkAction(value);
      if (result.ok) {
        setPosition(result.position);
        setError(null);
      } else {
        setPosition(null);
        setError(text.errors[result.error]);
      }
    });
  }

  return (
    <div>
      <input type="hidden" name="latitude" value={position ? String(position.lat) : ""} />
      <input type="hidden" name="longitude" value={position ? String(position.lng) : ""} />
      <label htmlFor="location-link" className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <MapPin className="size-4" aria-hidden />
        {text.label} <span className="font-normal text-muted">({text.optional})</span>
      </label>
      <div className="flex gap-2">
        <input
          id="location-link"
          type="text"
          inputMode="url"
          dir="ltr"
          value={value}
          onChange={(e) => read(e.target.value)}
          placeholder={text.placeholder}
          maxLength={500}
          autoComplete="off"
          aria-describedby="location-hint"
          aria-invalid={error ? true : undefined}
          className={`${inputClass} min-w-0 flex-1`}
        />
        {isShortMapLink(value) && !position && (
          <button
            type="button"
            onClick={resolveShortLink}
            disabled={pending}
            className="shrink-0 rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {pending ? text.checking : text.check}
          </button>
        )}
        {value && (
          <button type="button" onClick={() => read("")} className="shrink-0 rounded-lg px-3 text-sm font-semibold text-muted hover:text-danger">
            {text.clear}
          </button>
        )}
      </div>
      <p id="location-hint" className="mt-1 text-xs text-muted">
        {text.hint}
      </p>
      {error && <p className="mt-1 text-sm font-semibold text-danger">{error}</p>}
      {position && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-brand">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-4" aria-hidden />
            {text.found}
          </span>
          <a href={googleMapsUrl(position)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
            {text.open}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>
      )}
    </div>
  );
}
