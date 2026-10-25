"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import { MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AMMAN_CENTER, JORDAN_BOUNDS, mapConfig } from "@/lib/map-config";

type Text = { addPin: string; pinHint: string; removePin: string; pinSet: string; loading: string };

/**
 * Optional pin for the seller. The exact position is stored privately; the
 * public page only ever shows a rounded area.
 */
export function LocationPicker({ initialLat, initialLng, text }: { initialLat: string; initialLng: string; text: Text }) {
  const [open, setOpen] = useState(Boolean(initialLat && initialLng));
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: Number(initialLat), lng: Number(initialLng) } : null,
  );
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);

  useEffect(() => {
    if (!open || !container.current || mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { maxBounds: JORDAN_BOUNDS, maxBoundsViscosity: 1, minZoom: 7 });
      map.setView(pin ? [pin.lat, pin.lng] : AMMAN_CENTER, pin ? 15 : 11);
      L.tileLayer(mapConfig.tileUrl, { attribution: mapConfig.attribution, maxZoom: 18 }).addTo(map);
      const place = (lat: number, lng: number) => {
        markerRef.current?.remove();
        markerRef.current = L.circleMarker([lat, lng], { radius: 10, color: "#14524a", fillColor: "#1d6b5d", fillOpacity: 0.9 }).addTo(map);
      };
      if (pin) place(pin.lat, pin.lng);
      map.on("click", (e) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        place(lat, lng);
        setPin({ lat, lng });
      });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
    // The map is created once when opened; later pin changes come from clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  if (!mapConfig.enabled) return null;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="latitude" value={pin ? String(pin.lat) : ""} />
      <input type="hidden" name="longitude" value={pin ? String(pin.lng) : ""} />
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-fit items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold hover:bg-brand-soft"
        >
          <MapPin className="size-4" aria-hidden />
          {text.addPin}
        </button>
      ) : (
        <>
          <p className="text-sm text-muted">{text.pinHint}</p>
          <div ref={container} className="h-72 w-full overflow-hidden rounded-xl border border-border bg-brand-soft" aria-label={text.addPin} role="application">
            <span className="sr-only">{text.loading}</span>
          </div>
          {pin && (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-brand">{text.pinSet}</span>
              <button
                type="button"
                onClick={() => {
                  markerRef.current?.remove();
                  markerRef.current = null;
                  setPin(null);
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-danger hover:bg-danger/5"
              >
                <X className="size-4" aria-hidden />
                {text.removePin}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
