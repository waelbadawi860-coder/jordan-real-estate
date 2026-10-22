import { z } from "zod";
import { FLOOR_LEVELS, type FloorLevel } from "./floor";

export const PAGE_SIZE = 12;
export const sortOptions = ["newest", "price_asc", "price_desc"] as const;
export type SortOption = (typeof sortOptions)[number];

const slug = z.string().regex(/^[a-z0-9-]{2,60}$/);
const amount = z.coerce.number().positive().max(1_000_000_000);

// Each filter is validated on its own, so one bad value doesn't discard the rest.
const fieldSchemas = {
  q: z.string().trim().min(1).max(60),
  // "all" = the visitor chose "All" (no filter), so the next step of the tag board opens.
  deal: z.enum(["sale", "rent", "all"]),
  type: slug, // may be "all", like deal
  city: slug,
  hood: slug,
  min: amount,
  max: amount,
  amin: amount,
  amax: amount,
  beds: z.coerce.number().int().min(1).max(10),
  baths: z.coerce.number().int().min(1).max(10),
  floors: z.coerce.number().int().min(1).max(50),
  floor: z.enum(FLOOR_LEVELS),
  sort: z.enum(sortOptions),
  // "1" = only listings of verified offices.
  vo: z.enum(["1"]),
} as const;

export type SearchFilters = {
  q?: string;
  deal?: "sale" | "rent" | "all";
  type?: string;
  city?: string;
  hood?: string;
  min?: number;
  max?: number;
  amin?: number;
  amax?: number;
  beds?: number;
  baths?: number;
  floors?: number;
  floor?: FloorLevel;
  sort: SortOption;
  vo?: "1";
};

export type FilterKey = keyof typeof fieldSchemas;
export const filterKeys = Object.keys(fieldSchemas) as FilterKey[];

type RawParams = Record<string, string | string[] | undefined>;

/** Turns URL query parameters into validated filters. Unknown or invalid values are dropped. */
export function parseSearchParams(params: RawParams): { filters: SearchFilters; hadInvalid: boolean } {
  const filters: SearchFilters = { sort: "newest" };
  let hadInvalid = false;

  for (const key of filterKeys) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === "") continue;
    const parsed = fieldSchemas[key].safeParse(value);
    if (parsed.success) {
      (filters as Record<string, unknown>)[key] = parsed.data;
    } else {
      hadInvalid = true;
    }
  }
  return { filters, hadInvalid };
}

/** Validates a filters object received from the browser (e.g. by a Server Action). */
export function sanitizeFilters(input: unknown): SearchFilters {
  if (typeof input !== "object" || input === null) return { sort: "newest" };
  const params: RawParams = {};
  for (const key of filterKeys) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" || typeof value === "number") params[key] = String(value);
  }
  return parseSearchParams(params).filters;
}

/** Builds a query string from filters (omitting defaults). */
export function filtersToQuery(filters: Partial<SearchFilters>): string {
  const params = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (value === undefined || value === "" || (key === "sort" && value === "newest")) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export type Cursor = { v: string; id: number };

export const cursorSchema = z.object({
  v: z.string().min(1).max(40),
  id: z.number().int().positive(),
});
