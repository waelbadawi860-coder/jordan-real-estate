"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasLocale, localePath, type Locale } from "@/i18n/config";
import { getReferenceData } from "@/lib/data/public";
import { deletePhotoFiles, syncPublicPhotos } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { listingFormValues, listingSchema, type ListingInput } from "@/lib/validation/listing";

// Every action re-checks its input here, and the database enforces ownership
// (RLS), allowed status changes and posting limits on top of that.

export type ListingFormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const idSchema = z.number().int().positive();
const uuidSchema = z.string().uuid();

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return { supabase, userId: typeof userId === "string" ? userId : null };
}

function localeOf(value: unknown): Locale {
  return typeof value === "string" && hasLocale(value) ? value : "ar";
}

/** Maps database errors to translation keys in form.errors / preview / myListings. */
function dbErrorKey(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  for (const key of [
    "listing_limit_reached",
    "duplicate_listing",
    "contact_required",
    "images_required",
    "image_limit_reached",
    "renewal_not_yet_available",
    "invalid_status_transition",
    "account_not_active",
    "listing_not_found",
    "agreement_required",
    "transaction_details_required",
  ]) {
    if (message.includes(key)) return key;
  }
  if (error?.code === "42501") return "account_not_active";
  return "generic";
}

function invalidateListing(id: number) {
  updateTag("listings");
  updateTag(`listing-${id}`);
}

async function toRow(input: ListingInput) {
  const ref = await getReferenceData();
  const type = ref.propertyTypes.find((t) => t.id === input.propertyTypeId);
  const hasBedrooms = type?.hasBedrooms ?? false;
  const details: Record<string, string | number | boolean> = {};
  if (input.dealType === "rent" && input.rentPeriod) details.rent_period = input.rentPeriod;
  if (hasBedrooms && input.furnished) details.furnished = input.furnished === "yes";
  if (input.floor !== undefined) details.floor = input.floor;

  return {
    deal_type: input.dealType,
    property_type_id: input.propertyTypeId,
    city_id: input.cityId,
    neighborhood_id: input.neighborhoodId ?? null,
    title: input.title,
    description: input.description,
    // Sent as text so the exact decimal value reaches the database.
    price: input.price as unknown as number,
    area_sqm: (input.areaSqm ?? null) as unknown as number | null,
    bedrooms: hasBedrooms ? (input.bedrooms ?? null) : null,
    bathrooms: input.bathrooms ?? null,
    details,
    poster_type: input.posterType,
  };
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

export async function createListingAction(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  const locale = localeOf(formData.get("lang"));
  const parsed = listingSchema.safeParse(listingFormValues(formData));
  if (!parsed.success) return { error: "fixErrors", fieldErrors: fieldErrors(parsed.error.issues) };

  const { supabase, userId } = await requireUserId();
  if (!userId) redirect(`${localePath(locale, "/login")}?next=${encodeURIComponent(localePath(locale, "/post"))}`);

  const { data, error } = await supabase.from("listings").insert(await toRow(parsed.data)).select("id").single();
  if (error) {
    if (error.code === "23503") return { error: "fixErrors", fieldErrors: { neighborhoodId: "required" } };
    const key = dbErrorKey(error);
    return {
      error:
        key === "listing_limit_reached"
          ? "limitReached"
          : key === "duplicate_listing"
            ? "duplicate"
            : key === "account_not_active"
              ? "accountInactive"
              : "generic",
    };
  }

  const contact = await supabase.from("listing_contacts").insert({
    listing_id: data.id,
    phone: parsed.data.phone,
    allow_calls: parsed.data.allowCalls,
    allow_whatsapp: parsed.data.allowWhatsapp,
  });
  if (contact.error) console.error("Saving contact failed", { listingId: data.id, code: contact.error.code });

  redirect(`${localePath(locale, `/my/listings/${data.id}/edit`)}?step=photos`);
}

export async function updateListingAction(
  listingId: number,
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  if (!idSchema.safeParse(listingId).success) return { error: "generic" };
  const parsed = listingSchema.safeParse(listingFormValues(formData));
  if (!parsed.success) return { error: "fixErrors", fieldErrors: fieldErrors(parsed.error.issues) };

  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "accountInactive" };

  const { data, error } = await supabase
    .from("listings")
    .update(await toRow(parsed.data))
    .eq("id", listingId)
    .select("id");
  if (error) {
    if (error.code === "23503") return { error: "fixErrors", fieldErrors: { neighborhoodId: "required" } };
    return { error: dbErrorKey(error) === "account_not_active" ? "accountInactive" : "generic" };
  }
  if (!data || data.length === 0) return { error: "notEditable" };

  const contactValues = {
    phone: parsed.data.phone,
    allow_calls: parsed.data.allowCalls,
    allow_whatsapp: parsed.data.allowWhatsapp,
  };
  const updated = await supabase.from("listing_contacts").update(contactValues).eq("listing_id", listingId).select("listing_id");
  if (!updated.error && (updated.data?.length ?? 0) === 0) {
    await supabase.from("listing_contacts").insert({ listing_id: listingId, ...contactValues });
  }

  // Editing a published listing sends it back for review (database trigger),
  // so its public photos must be withdrawn too.
  await syncPublicPhotos(listingId);
  invalidateListing(listingId);
  return { saved: true };
}

// ----------------------------------------------------------------------------
// Photos
// ----------------------------------------------------------------------------

const photoSchema = z.object({
  listingId: idSchema,
  storagePath: z.string().regex(/^[0-9a-f-]{36}\/[0-9]{1,18}\/[0-9a-f-]{36}\.(webp|jpg|png)$/),
  thumbPath: z.string().regex(/^[0-9a-f-]{36}\/[0-9]{1,18}\/[0-9a-f-]{36}\.(webp|jpg|png)$/).nullable(),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
});

export async function addPhotoAction(input: unknown): Promise<ActionResult> {
  const parsed = photoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { listingId, storagePath, thumbPath, width, height } = parsed.data;

  const { supabase, userId } = await requireUserId();
  if (!userId) return { ok: false, error: "account_not_active" };
  const prefix = `${userId}/${listingId}/`;
  if (!storagePath.startsWith(prefix) || (thumbPath && !thumbPath.startsWith(prefix))) return { ok: false, error: "generic" };

  const { data: existing } = await supabase
    .from("listing_images")
    .select("position")
    .eq("listing_id", listingId)
    .order("position", { ascending: false })
    .limit(1);
  const position = Math.min((existing?.[0]?.position ?? -1) + 1, 49);

  const { error } = await supabase
    .from("listing_images")
    .insert({ listing_id: listingId, storage_path: storagePath, thumb_path: thumbPath, position, width, height });
  if (error) {
    await deletePhotoFiles([storagePath, thumbPath].filter((p): p is string => Boolean(p)));
    return { ok: false, error: dbErrorKey(error) };
  }
  // Adding a photo to an approved listing sends it back for review (trigger).
  await syncPublicPhotos(listingId);
  invalidateListing(listingId);
  return { ok: true };
}

export async function deletePhotoAction(imageId: unknown): Promise<ActionResult> {
  const id = uuidSchema.safeParse(imageId);
  if (!id.success) return { ok: false, error: "generic" };
  const { supabase, userId } = await requireUserId();
  if (!userId) return { ok: false, error: "account_not_active" };

  const { data: image } = await supabase
    .from("listing_images")
    .select("id, listing_id, storage_path, thumb_path")
    .eq("id", id.data)
    .maybeSingle();
  if (!image) return { ok: false, error: "generic" };

  const { data: deleted, error } = await supabase.from("listing_images").delete().eq("id", image.id).select("id");
  if (error || !deleted?.length) return { ok: false, error: "notEditable" };

  await deletePhotoFiles([image.storage_path, image.thumb_path].filter((p): p is string => Boolean(p)));
  invalidateListing(image.listing_id);
  return { ok: true };
}

export async function makeMainPhotoAction(imageId: unknown): Promise<ActionResult> {
  const id = uuidSchema.safeParse(imageId);
  if (!id.success) return { ok: false, error: "generic" };
  const { supabase, userId } = await requireUserId();
  if (!userId) return { ok: false, error: "account_not_active" };

  const { data: image } = await supabase.from("listing_images").select("listing_id").eq("id", id.data).maybeSingle();
  if (!image) return { ok: false, error: "generic" };
  const { data: all } = await supabase
    .from("listing_images")
    .select("id, position")
    .eq("listing_id", image.listing_id)
    .order("position");
  const ordered = [id.data, ...(all ?? []).map((i) => i.id).filter((i) => i !== id.data)];
  for (const [position, imgId] of ordered.entries()) {
    const { error } = await supabase.from("listing_images").update({ position }).eq("id", imgId);
    if (error) return { ok: false, error: "notEditable" };
  }
  invalidateListing(image.listing_id);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Status changes
// ----------------------------------------------------------------------------

const ownerStatuses = ["pending_approval", "draft", "sold", "rented", "withdrawn", "archived"] as const;
const reasonSchema = z.enum(["unavailable", "changed_mind", "other"]).optional();

export async function changeStatusAction(listingId: unknown, status: unknown, reason?: unknown): Promise<ActionResult> {
  const id = idSchema.safeParse(listingId);
  const target = z.enum(ownerStatuses).safeParse(status);
  const why = reasonSchema.safeParse(reason ?? undefined);
  if (!id.success || !target.success || !why.success) return { ok: false, error: "generic" };

  const { supabase, userId } = await requireUserId();
  if (!userId) return { ok: false, error: "account_not_active" };

  const { data, error } = await supabase.rpc("change_listing_status", {
    p_listing_id: id.data,
    p_new_status: target.data,
    p_reason: why.data ? `owner:${why.data}` : undefined,
  });
  if (error) return { ok: false, error: dbErrorKey(error) };

  await syncPublicPhotos(id.data);
  invalidateListing(id.data);
  return { ok: true, message: data === "published" ? "published" : target.data === "pending_approval" ? "submitted" : "updated" };
}

export async function renewListingAction(listingId: unknown): Promise<ActionResult> {
  const id = idSchema.safeParse(listingId);
  if (!id.success) return { ok: false, error: "generic" };
  const { supabase, userId } = await requireUserId();
  if (!userId) return { ok: false, error: "account_not_active" };

  const { error } = await supabase.rpc("renew_listing", { p_listing_id: id.data });
  if (error) return { ok: false, error: dbErrorKey(error) };
  await syncPublicPhotos(id.data);
  invalidateListing(id.data);
  return { ok: true, message: "renewed" };
}

export async function deleteDraftAction(listingId: unknown, lang: unknown): Promise<ActionResult> {
  const id = idSchema.safeParse(listingId);
  if (!id.success) return { ok: false, error: "generic" };
  const { supabase, userId } = await requireUserId();
  if (!userId) return { ok: false, error: "account_not_active" };

  const { data: images } = await supabase
    .from("listing_images")
    .select("storage_path, thumb_path")
    .eq("listing_id", id.data);
  const { data: deleted, error } = await supabase.from("listings").delete().eq("id", id.data).select("id");
  if (error || !deleted?.length) return { ok: false, error: "notEditable" };

  await deletePhotoFiles((images ?? []).flatMap((i) => [i.storage_path, i.thumb_path].filter((p): p is string => Boolean(p))));
  redirect(localePath(localeOf(lang), "/my/listings"));
}

// ----------------------------------------------------------------------------
// Favourites
// ----------------------------------------------------------------------------

export async function toggleFavouriteAction(listingId: unknown): Promise<{ saved: boolean } | { error: "login" | "generic" }> {
  const id = idSchema.safeParse(listingId);
  if (!id.success) return { error: "generic" };
  const { supabase, userId } = await requireUserId();
  if (!userId) return { error: "login" };

  const { data: removed } = await supabase
    .from("favourites")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", id.data)
    .select("listing_id");
  if (removed?.length) return { saved: false };

  const { error } = await supabase.from("favourites").insert({ listing_id: id.data });
  if (error) return { error: "generic" };
  return { saved: true };
}
