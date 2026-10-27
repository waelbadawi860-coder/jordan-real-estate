import { z } from "zod";
import { FLOOR_LEVELS } from "@/lib/floor";
import { BUILDING_AGES, FEATURES, FURNISHED, LAND_SERVICES, NEARBY, ZONINGS } from "@/lib/listing-details";

// Shared by the browser (instant feedback) and the server (the real check).
// Error messages are translation keys from messages/*.json → form.errors.

/** Accepts 07XXXXXXXX, 7XXXXXXXX, 06XXXXXXX, 00962…, +962… and returns +962…, or null. */
export function normalizeJordanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "00");
  let national: string;
  if (/^00962\d+$/.test(digits)) national = digits.slice(5);
  else if (/^962\d+$/.test(digits)) national = digits.slice(3);
  else if (/^0\d+$/.test(digits)) national = digits.slice(1);
  else if (/^\d+$/.test(digits)) national = digits;
  else return null;
  // Mobile: 7[789]XXXXXXX (9 digits). Landline: [2356]XXXXXXX (8 digits).
  if (/^7[789]\d{7}$/.test(national) || /^[2356]\d{7}$/.test(national)) return `+962${national}`;
  return null;
}

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: "invalidNumber" }).int("invalidNumber").min(min, "invalidNumber").max(max, "invalidNumber").optional(),
  );

const optionalDecimal = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : String(v).replace(/,/g, "")),
    z
      .string()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, "invalidNumber")
      .refine((s) => Number(s) > 0 && Number(s) <= max, "invalidNumber")
      .optional(),
  );

const optionalChoice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.enum(values).optional());

/** Ticked boxes: anything not on the list is ignored. */
const keyList = <T extends string>(values: readonly T[]) =>
  z
    .array(z.string())
    .default([])
    .transform((list) => values.filter((key) => list.includes(key)));

export const listingSchema = z
  .object({
    dealType: z.enum(["sale", "rent"], { message: "required" }),
    rentPeriod: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["monthly", "yearly"]).optional()),
    propertyTypeId: z.coerce.number({ message: "required" }).int().positive("required"),
    cityId: z.coerce.number({ message: "required" }).int().positive("required"),
    neighborhoodId: z.coerce.number({ message: "required" }).int().positive("required"),
    title: z.string().trim().min(5, "titleLength").max(120, "titleLength"),
    description: z.string().trim().max(5000, "descriptionLength").default(""),
    // Exact decimal string (JOD has 3 decimals). Never converted to a float.
    price: z
      .string()
      .trim()
      .transform((s) => s.replace(/,/g, ""))
      .pipe(z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, "invalidPrice"))
      .refine((s) => Number(s) > 0, "invalidPrice"),
    areaSqm: optionalDecimal(9_999_999),
    bedrooms: optionalInt(0, 50),
    bathrooms: optionalInt(0, 50),
    floorsCount: optionalInt(1, 100),
    floor: z.preprocess((v) => (v === "" ? undefined : v), z.enum(FLOOR_LEVELS).optional()),
    furnished: optionalChoice(FURNISHED),
    buildingAge: optionalChoice(BUILDING_AGES),
    features: keyList(FEATURES),
    nearby: keyList(NEARBY),
    zoning: optionalChoice(ZONINGS),
    frontageM: optionalInt(1, 10_000),
    services: keyList(LAND_SERVICES),
    posterType: z.enum(["owner", "agent"]).default("owner"),
    phone: z
      .string()
      .trim()
      .min(1, "invalidPhone")
      .transform((s, ctx) => {
        const normalized = normalizeJordanPhone(s);
        if (!normalized) {
          ctx.addIssue({ code: "custom", message: "invalidPhone" });
          return z.NEVER;
        }
        return normalized;
      }),
    allowCalls: z.boolean(),
    allowWhatsapp: z.boolean(),
    // Optional map pin, limited to Jordan (the database enforces the same box).
    latitude: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(29).max(33.5).optional()),
    longitude: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(34.8).max(39.4).optional()),
  })
  .superRefine((value, ctx) => {
    if (!value.allowCalls && !value.allowWhatsapp) {
      ctx.addIssue({ code: "custom", path: ["allowWhatsapp"], message: "contactMethod" });
    }
    if (value.allowWhatsapp && value.phone && !/^\+9627/.test(value.phone)) {
      // WhatsApp needs a mobile number.
      ctx.addIssue({ code: "custom", path: ["phone"], message: "invalidPhone" });
    }
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "invalidNumber" });
    }
    if (value.dealType === "rent" && !value.rentPeriod) {
      ctx.addIssue({ code: "custom", path: ["rentPeriod"], message: "required" });
    }
  });

export type ListingInput = z.infer<typeof listingSchema>;

/** Reads the listing form fields from submitted form data. */
export function listingFormValues(formData: FormData) {
  const text = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    dealType: text("dealType"),
    rentPeriod: text("rentPeriod"),
    propertyTypeId: text("propertyTypeId"),
    cityId: text("cityId"),
    neighborhoodId: text("neighborhoodId"),
    title: text("title"),
    description: text("description"),
    price: text("price"),
    areaSqm: text("areaSqm"),
    bedrooms: text("bedrooms"),
    bathrooms: text("bathrooms"),
    floorsCount: text("floorsCount"),
    floor: text("floor"),
    furnished: text("furnished"),
    buildingAge: text("buildingAge"),
    features: formData.getAll("features").filter((v): v is string => typeof v === "string"),
    nearby: formData.getAll("nearby").filter((v): v is string => typeof v === "string"),
    zoning: text("zoning"),
    frontageM: text("frontageM"),
    services: formData.getAll("services").filter((v): v is string => typeof v === "string"),
    posterType: text("posterType") || "owner",
    phone: text("phone"),
    allowCalls: formData.get("allowCalls") === "on",
    allowWhatsapp: formData.get("allowWhatsapp") === "on",
    latitude: text("latitude"),
    longitude: text("longitude"),
  };
}
