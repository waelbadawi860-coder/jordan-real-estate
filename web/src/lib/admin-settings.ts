import { z } from "zod";

// The site settings an admin may edit from the dashboard, with the allowed
// values for each. The commission switch is deliberately not here: it is
// added in Stage 6 and stays off until a lawyer approves the model.

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const bool = z.enum(["true", "false"]).transform((v) => v === "true");

export const settingSchemas = {
  site_name_ar: z.string().trim().min(2).max(40),
  site_name_en: z.string().trim().min(2).max(40),
  contact_email: z.union([z.literal("").transform(() => null), z.string().trim().email().max(254)]),
  listing_expiry_days: int(1, 365),
  renewal_window_days: int(1, 60),
  max_new_listings_per_24h: int(1, 100),
  max_images_per_listing: int(1, 40),
  min_images_per_listing: int(0, 10),
  image_max_dimension_px: int(800, 3000),
  require_listing_approval: bool,
  watermark_enabled: bool,
  max_reports_per_24h: int(1, 100),
  terms_version: z.string().trim().min(1).max(40),
  privacy_version: z.string().trim().min(1).max(40),
} as const;

export type EditableSetting = keyof typeof settingSchemas;
export const editableSettings = Object.keys(settingSchemas) as EditableSetting[];

export const booleanSettings: EditableSetting[] = ["require_listing_approval", "watermark_enabled"];
export const numberSettings: EditableSetting[] = [
  "listing_expiry_days",
  "renewal_window_days",
  "max_new_listings_per_24h",
  "max_images_per_listing",
  "min_images_per_listing",
  "image_max_dimension_px",
  "max_reports_per_24h",
];
