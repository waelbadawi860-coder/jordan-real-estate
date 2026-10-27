import { z } from "zod";

// The site settings an admin may edit from the dashboard, with the allowed
// values for each. Turning commissions on is additionally blocked on the live
// site while the current agreement is an unreviewed draft (see saveSettingAction).

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const bool = z.enum(["true", "false"]).transform((v) => v === "true");

export const settingSchemas = {
  site_name_ar: z.string().trim().min(2).max(40),
  site_name_en: z.string().trim().min(2).max(40),
  contact_email: z.union([z.literal("").transform(() => null), z.string().trim().email().max(254)]),
  listing_expiry_days: int(1, 365),
  renewal_window_days: int(1, 60),
  max_new_listings_per_24h: int(1, 100),
  max_active_listings_individual: int(1, 1000),
  price_feature_7_days: int(0, 1000),
  price_feature_14_days: int(0, 1000),
  price_feature_30_days: int(0, 1000),
  price_bump: int(0, 1000),
  max_images_per_listing: int(1, 40),
  min_images_per_listing: int(0, 10),
  image_max_dimension_px: int(800, 3000),
  require_listing_approval: bool,
  require_admin_mfa: bool,
  max_reports_per_24h: int(1, 100),
  report_auto_hold_threshold: int(0, 50),
  terms_version: z.string().trim().min(1).max(40),
  declaration_version: z.string().trim().min(1).max(40),
  removed_photo_retention_days: int(30, 3650),
  privacy_version: z.string().trim().min(1).max(40),
  commission_enabled: bool,
  payment_cliq_alias: z.string().trim().max(60),
  payment_cliq_holder: z.string().trim().max(100),
  payment_bank_name: z.string().trim().max(100),
  payment_bank_account_name: z.string().trim().max(100),
  // Jordanian IBAN: JO + 2 check digits + 4-letter bank code + 4-digit branch + 18 characters (30 in total).
  payment_iban: z
    .string()
    .transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^$|^JO\d{2}[A-Z]{4}\d{4}[A-Z0-9]{18}$/)),
  payment_note_ar: z.string().trim().max(500),
  payment_note_en: z.string().trim().max(500),
} as const;

export type EditableSetting = keyof typeof settingSchemas;
export const editableSettings = Object.keys(settingSchemas) as EditableSetting[];

export const booleanSettings: EditableSetting[] = ["require_listing_approval", "require_admin_mfa", "commission_enabled"];
export const numberSettings: EditableSetting[] = [
  "listing_expiry_days",
  "renewal_window_days",
  "max_new_listings_per_24h",
  "max_active_listings_individual",
  "price_feature_7_days",
  "price_feature_14_days",
  "price_feature_30_days",
  "price_bump",
  "max_images_per_listing",
  "min_images_per_listing",
  "image_max_dimension_px",
  "max_reports_per_24h",
  "report_auto_hold_threshold",
  "removed_photo_retention_days",
];
