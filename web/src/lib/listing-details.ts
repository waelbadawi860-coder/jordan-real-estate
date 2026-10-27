import type { Json } from "@/lib/database.types";

// Extra ad details kept in listings.details and shown on the listing page only
// (they are not search filters). The database accepts exactly these keys and
// values (migration 20261030090000), so keep both lists in step.

export const FURNISHED = ["yes", "no", "partly"] as const;
export const BUILDING_AGES = ["under_construction", "under_1", "1_5", "6_9", "10_19", "20_plus"] as const;
export const FEATURE_GROUPS = {
  inside: [
    "central_heating",
    "air_conditioning",
    "underfloor_heating",
    "maid_room",
    "laundry_room",
    "built_in_kitchen",
    "balcony",
    "double_glazing",
    "wardrobes",
  ],
  building: [
    "elevator",
    "parking",
    "storage",
    "garden",
    "solar_heater",
    "solar_panels",
    "backup_power",
    "security",
    "pool",
    "accessibility",
  ],
} as const;
export const FEATURES = [...FEATURE_GROUPS.inside, ...FEATURE_GROUPS.building] as const;
export const NEARBY = ["school", "university", "mosque", "hospital", "pharmacy", "supermarket", "mall", "public_transport", "main_road"] as const;
export const ZONINGS = ["res_a", "res_b", "res_c", "res_d", "rural", "commercial", "industrial", "agricultural"] as const;
export const LAND_SERVICES = ["electricity", "water", "sewage"] as const;

export type Furnished = (typeof FURNISHED)[number];
export type BuildingAge = (typeof BUILDING_AGES)[number];
export type Feature = (typeof FEATURES)[number];
export type Nearby = (typeof NEARBY)[number];
export type Zoning = (typeof ZONINGS)[number];
export type LandService = (typeof LAND_SERVICES)[number];

export type ListingExtras = {
  furnished: Furnished | null;
  buildingAge: BuildingAge | null;
  features: Feature[];
  nearby: Nearby[];
  zoning: Zoning | null;
  frontageM: number | null;
  services: LandService[];
};

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function pickAll<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  // Kept in the order of the list, so every ad shows them the same way.
  return allowed.filter((key) => value.includes(key));
}

/** Reads the extra details from a listing's details column. */
export function extrasOf(details: Json): ListingExtras {
  const d = details && typeof details === "object" && !Array.isArray(details) ? details : {};
  return {
    furnished: pick(d.furnished, FURNISHED),
    buildingAge: pick(d.building_age, BUILDING_AGES),
    features: pickAll(d.features, FEATURES),
    nearby: pickAll(d.nearby, NEARBY),
    zoning: pick(d.zoning, ZONINGS),
    frontageM: typeof d.frontage_m === "number" ? d.frontage_m : null,
    services: pickAll(d.services, LAND_SERVICES),
  };
}


/** The extra details as listing-form values (empty when not set). */
export function extrasFormValues(extras?: ListingExtras) {
  return {
    furnished: extras?.furnished ?? "",
    buildingAge: extras?.buildingAge ?? "",
    features: extras?.features ?? [],
    nearby: extras?.nearby ?? [],
    zoning: extras?.zoning ?? "",
    frontageM: extras?.frontageM === null || extras?.frontageM === undefined ? "" : String(extras.frontageM),
    services: extras?.services ?? [],
  };
}
