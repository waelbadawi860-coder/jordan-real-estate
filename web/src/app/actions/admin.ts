"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { getAdminActor } from "@/lib/admin";
import { isLiveSite } from "@/lib/env";
import { editableSettings, settingSchemas, type EditableSetting } from "@/lib/admin-settings";
import { syncPublicPhotos, syncSellerPhotos } from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";

// Every admin action starts by confirming, on the server, that the caller is
// an active administrator. The database repeats the check (RLS + is_admin()).

export type AdminResult = { ok: true } | { ok: false; error: "notAllowed" | "reasonRequired" | "invalid" | "invalidTransition" | "ownAccount" | "duplicate" | "draftAgreement" | "generic" };

const idSchema = z.number().int().positive();
const uuidSchema = z.string().uuid();
const reasonSchema = z.string().trim().max(1000);

function errorOf(error: { message?: string; code?: string } | null): AdminResult {
  const m = error?.message ?? "";
  if (m.includes("reason_required")) return { ok: false, error: "reasonRequired" };
  if (m.includes("invalid_status_transition")) return { ok: false, error: "invalidTransition" };
  if (m.includes("cannot_change_own_status")) return { ok: false, error: "ownAccount" };
  if (m.includes("not_allowed") || error?.code === "42501") return { ok: false, error: "notAllowed" };
  if (error?.code === "23505") return { ok: false, error: "duplicate" };
  if (error?.code === "23514" || error?.code === "22P02") return { ok: false, error: "invalid" };
  return { ok: false, error: "generic" };
}

function refreshListing(id: number) {
  updateTag("listings");
  updateTag(`listing-${id}`);
}

// ----------------------------------------------------------------------------
// Listings
// ----------------------------------------------------------------------------

const moderation = { approve: "published", reject: "rejected", take_down: "rejected", archive: "archived" } as const;

export async function moderateListingAction(listingId: unknown, action: unknown, reason?: unknown): Promise<AdminResult> {
  const id = idSchema.safeParse(listingId);
  const act = z.enum(["approve", "reject", "take_down", "archive"]).safeParse(action);
  const why = reasonSchema.safeParse(reason ?? "");
  if (!id.success || !act.success || !why.success) return { ok: false, error: "invalid" };
  if ((act.data === "reject" || act.data === "take_down") && !why.data) return { ok: false, error: "reasonRequired" };

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };

  const { error } = await actor.supabase.rpc("change_listing_status", {
    p_listing_id: id.data,
    p_new_status: moderation[act.data],
    p_reason: why.data || undefined,
  });
  if (error) return errorOf(error);

  await syncPublicPhotos(id.data);
  refreshListing(id.data);
  return { ok: true };
}

export async function setListingExpiryAction(listingId: unknown, mode: unknown): Promise<AdminResult> {
  const id = idSchema.safeParse(listingId);
  const m = z.enum(["extend30", "now"]).safeParse(mode);
  if (!id.success || !m.success) return { ok: false, error: "invalid" };
  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };

  // The 30 days are counted from the moment the admin presses the button.
  const expiresAt = new Date(Date.now() + (m.data === "extend30" ? 30 * 86_400_000 : -1000)).toISOString();
  const { error } = await actor.supabase.rpc("admin_set_listing_expiry", { p_listing_id: id.data, p_expires_at: expiresAt });
  if (error) return errorOf(error);

  await syncPublicPhotos(id.data);
  refreshListing(id.data);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

export async function setUserStatusAction(userId: unknown, status: unknown, reason: unknown, takeDownListings?: unknown): Promise<AdminResult> {
  const id = uuidSchema.safeParse(userId);
  const s = z.enum(["active", "suspended"]).safeParse(status);
  const why = reasonSchema.min(1).safeParse(reason);
  if (!id.success || !s.success) return { ok: false, error: "invalid" };
  if (!why.success) return { ok: false, error: "reasonRequired" };

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };

  const { error } = await actor.supabase.rpc("admin_set_user_status", {
    p_user_id: id.data,
    p_status: s.data,
    p_reason: why.data,
  });
  if (error) return errorOf(error);

  if (s.data === "suspended" && takeDownListings === true) {
    const { data: live } = await actor.supabase
      .from("listings")
      .select("id")
      .eq("seller_id", id.data)
      .in("status", ["published", "pending_approval"]);
    for (const { id: listingId } of live ?? []) {
      await actor.supabase.rpc("change_listing_status", {
        p_listing_id: listingId,
        p_new_status: "rejected",
        p_reason: `account_suspended: ${why.data}`,
      });
    }
    await syncSellerPhotos(id.data);
    updateTag("listings");
  }
  return { ok: true };
}

export async function completeDeletionAction(userId: unknown, reason: unknown): Promise<AdminResult> {
  const id = uuidSchema.safeParse(userId);
  const why = reasonSchema.min(1).safeParse(reason);
  if (!id.success) return { ok: false, error: "invalid" };
  if (!why.success) return { ok: false, error: "reasonRequired" };

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };

  // 1) Database: withdraw listings, remove phone numbers, favourites, name.
  const { error } = await actor.supabase.rpc("admin_anonymize_user", { p_user_id: id.data, p_reason: why.data });
  if (error) return errorOf(error);

  // 2) Login account: replace the email and block sign-in permanently.
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(id.data, {
    email: `deleted-${id.data}@deleted.invalid`,
    email_confirm: true,
    ban_duration: "876000h",
    user_metadata: {},
  });
  if (authError) {
    console.error("Anonymizing login failed", { userId: id.data, code: authError.code });
    return { ok: false, error: "generic" };
  }
  await admin.rpc("record_admin_action", {
    p_actor: actor.userId,
    p_action: "login_anonymized",
    p_entity_type: "profile",
    p_entity_id: id.data,
    p_details: {},
  });

  await syncSellerPhotos(id.data);
  updateTag("listings");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Reports and messages
// ----------------------------------------------------------------------------

const reportTables = { listing: "listing_reports", user: "user_reports", message: "contact_messages" } as const;

export async function resolveReportAction(kind: unknown, reportId: unknown, status: unknown, note?: unknown): Promise<AdminResult> {
  const k = z.enum(["listing", "user", "message"]).safeParse(kind);
  const id = idSchema.safeParse(reportId);
  const s = z.enum(["reviewing", "resolved", "dismissed"]).safeParse(status);
  const n = reasonSchema.safeParse(note ?? "");
  if (!k.success || !id.success || !s.success || !n.success) return { ok: false, error: "invalid" };

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };

  const { data, error } = await actor.supabase
    .from(reportTables[k.data])
    .update({ status: s.data, resolution_note: n.data || null })
    .eq("id", id.data)
    .select("id");
  if (error) return errorOf(error);
  if (!data?.length) return { ok: false, error: "notAllowed" };
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

export async function saveSettingAction(key: unknown, value: unknown): Promise<AdminResult> {
  if (typeof key !== "string" || !(editableSettings as string[]).includes(key)) return { ok: false, error: "invalid" };
  const parsed = settingSchemas[key as EditableSetting].safeParse(value);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };

  // Safety: on the live site, commissions can only be switched on once the
  // current agreement has been marked as reviewed by a lawyer.
  if (key === "commission_enabled" && parsed.data === true && isLiveSite) {
    const { data: current } = await actor.supabase.from("agreement_versions").select("is_draft").eq("is_current", true).maybeSingle();
    if (!current || current.is_draft) return { ok: false, error: "draftAgreement" };
  }

  // The audit trigger records who changed what, with old and new values.
  const { data, error } = await actor.supabase
    .from("site_settings")
    .update({ value: parsed.data })
    .eq("key", key)
    .select("key");
  if (error) return errorOf(error);
  if (!data?.length) return { ok: false, error: "notAllowed" };
  updateTag("reference-data");
  updateTag("commission-terms");
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Reference data: cities, neighborhoods, property types
// ----------------------------------------------------------------------------

const names = {
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/),
  sortOrder: z.coerce.number().int().min(0).max(10000),
};

const cityInput = z.object({ ...names, id: idSchema.optional(), isActive: z.boolean().default(true) });
const hoodInput = z.object({ ...names, id: idSchema.optional(), cityId: idSchema, isActive: z.boolean().default(true) });
const typeInput = z.object({
  ...names,
  id: idSchema.optional(),
  hasBedrooms: z.boolean(),
  hasBathrooms: z.boolean().default(true),
  hasFloor: z.boolean().default(false),
  hasFurnished: z.boolean().default(false),
  allowedDeals: z.array(z.enum(["sale", "rent"])).min(1).max(2).default(["sale", "rent"]),
  isActive: z.boolean().default(true),
});

export async function saveCityAction(input: unknown): Promise<AdminResult> {
  const p = cityInput.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };
  const row = { name_ar: p.data.nameAr, name_en: p.data.nameEn, slug: p.data.slug, sort_order: p.data.sortOrder, is_active: p.data.isActive };
  const { error } = p.data.id
    ? await actor.supabase.from("cities").update(row).eq("id", p.data.id)
    : await actor.supabase.from("cities").insert(row);
  if (error) return errorOf(error);
  updateTag("reference-data");
  return { ok: true };
}

export async function saveNeighborhoodAction(input: unknown): Promise<AdminResult> {
  const p = hoodInput.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };
  const row = { name_ar: p.data.nameAr, name_en: p.data.nameEn, slug: p.data.slug, sort_order: p.data.sortOrder, is_active: p.data.isActive };
  const { error } = p.data.id
    ? await actor.supabase.from("neighborhoods").update(row).eq("id", p.data.id)
    : await actor.supabase.from("neighborhoods").insert({ ...row, city_id: p.data.cityId });
  if (error) return errorOf(error);
  updateTag("reference-data");
  return { ok: true };
}

export async function savePropertyTypeAction(input: unknown): Promise<AdminResult> {
  const p = typeInput.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const actor = await getAdminActor();
  if (!actor) return { ok: false, error: "notAllowed" };
  const row = {
    name_ar: p.data.nameAr,
    name_en: p.data.nameEn,
    slug: p.data.slug,
    sort_order: p.data.sortOrder,
    is_active: p.data.isActive,
    has_bedrooms: p.data.hasBedrooms,
    has_bathrooms: p.data.hasBathrooms,
    has_floor: p.data.hasFloor,
    has_furnished: p.data.hasFurnished,
    allowed_deals: [...new Set(p.data.allowedDeals)],
  };
  const { error } = p.data.id
    ? await actor.supabase.from("property_types").update(row).eq("id", p.data.id)
    : await actor.supabase.from("property_types").insert(row);
  if (error) return errorOf(error);
  updateTag("reference-data");
  return { ok: true };
}
