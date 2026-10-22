import { JORDAN_BOUNDS } from "./map-config";

// Reads a position from what a seller pastes: plain coordinates
// ("31.95, 35.91") or a Google Maps link. Short links (maps.app.goo.gl) are
// opened on the server first (see resolveMapLinkAction).

export type LatLng = { lat: number; lng: number };

export function inJordan({ lat, lng }: LatLng): boolean {
  const [[minLat, minLng], [maxLat, maxLng]] = JORDAN_BOUNDS;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

function pair(lat: string, lng: string): LatLng | null {
  const p = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) } : null;
}

/** Coordinates from text or a full Google Maps address; null when none are found. */
export function parseLocation(input: string): LatLng | null {
  const text = input.trim().replace(/[،，]/g, ","); // Arabic/full-width comma
  if (!text) return null;

  // Plain "lat, lng" (or "lat lng").
  const plain = new RegExp(`^${NUM}\\s*[,\\s]\\s*${NUM}$`).exec(text);
  if (plain) return pair(plain[1], plain[2]);

  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // keep the raw text
  }
  // The place's own position (!3d<lat>!4d<lng>) is more precise than the view centre (@lat,lng).
  const place = new RegExp(`!3d${NUM}!4d${NUM}`).exec(decoded);
  if (place) return pair(place[1], place[2]);
  const query = new RegExp(`[?&](?:q|query|ll|destination|center)=(?:loc:)?${NUM}\\s*,\\s*${NUM}`).exec(decoded);
  if (query) return pair(query[1], query[2]);
  const at = new RegExp(`@${NUM},${NUM}`).exec(decoded);
  if (at) return pair(at[1], at[2]);
  const path = new RegExp(`/(?:place|search|dir)/${NUM},\\s*${NUM}`).exec(decoded);
  if (path) return pair(path[1], path[2]);
  return null;
}

/** Hosts whose short links may be opened on the server to find the full address. */
export const SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl"];
export const GOOGLE_MAPS_HOSTS = ["google.com", "www.google.com", "maps.google.com", "google.jo", "www.google.jo"];

export function isShortMapLink(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" && SHORT_LINK_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

/** A Google Maps link that opens the given position (used for the public, rounded position). */
export function googleMapsUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
