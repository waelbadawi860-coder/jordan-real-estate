"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { JORDAN_BOUNDS, mapConfig } from "@/lib/map-config";

/**
 * Shows the position the seller added (only when a map provider is set up).
 * Loads map tiles only when the visitor asks for it,
 * which keeps pages light and map-provider costs low.
 */
export function ApproxMap({ lat, lng, text }: { lat: number; lng: number; text: { showMap: string; approxNote: string; loading: string } }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!open || !container.current || mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { maxBounds: JORDAN_BOUNDS, minZoom: 7, maxZoom: 15, scrollWheelZoom: false });
      map.setView([lat, lng], 14);
      L.tileLayer(mapConfig.tileUrl, { attribution: mapConfig.attribution, maxZoom: 15 }).addTo(map);
      L.circle([lat, lng], { radius: 900, color: "#1d6b5d", fillColor: "#1d6b5d", fillOpacity: 0.15 }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
  }, [open, lat, lng]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  if (!mapConfig.enabled) return null;

  return (
    <section className="flex flex-col gap-2" aria-label={text.showMap}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-fit items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold hover:bg-brand-soft"
        >
          <MapPin className="size-4" aria-hidden />
          {text.showMap}
        </button>
      ) : (
        <>
          <div ref={container} className="h-72 w-full overflow-hidden rounded-xl border border-border bg-brand-soft" role="region" aria-label={text.showMap}>
            <span className="sr-only">{text.loading}</span>
          </div>
          <p className="text-xs text-muted">{text.approxNote}</p>
        </>
      )}
    </section>
  );
}
