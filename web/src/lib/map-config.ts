// Map tile provider, configurable without code changes.
//
// The free OpenStreetMap tile servers may only be used lightly and must not
// carry a commercial website, so they are used in DEVELOPMENT only. In
// production, maps stay hidden until a provider is configured, for example:
//   NEXT_PUBLIC_MAP_TILE_URL=https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png
//   NEXT_PUBLIC_MAP_ATTRIBUTION=&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap contributors
// (see docs/STAGE-7-PROVIDERS.md for options and costs).

const OSM_DEV_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type MapConfig = { enabled: boolean; tileUrl: string; attribution: string };

export const mapConfig: MapConfig = (() => {
  const url = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  if (url) return { enabled: true, tileUrl: url, attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || OSM_ATTRIBUTION };
  if (process.env.NODE_ENV !== "production") return { enabled: true, tileUrl: OSM_DEV_TILES, attribution: OSM_ATTRIBUTION };
  return { enabled: false, tileUrl: "", attribution: "" };
})();

/** Jordan's bounding box (same limits the database enforces). */
export const JORDAN_BOUNDS: [[number, number], [number, number]] = [
  [29.0, 34.8],
  [33.5, 39.4],
];
export const AMMAN_CENTER: [number, number] = [31.955, 35.91];
