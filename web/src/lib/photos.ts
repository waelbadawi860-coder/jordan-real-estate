import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Listing photos live in two storage buckets:
//   listing-photos         private — sellers upload here
//   listing-photos-public  public  — only this server code writes here
// A photo is copied to the public bucket only while its listing is published,
// and removed again when the listing is withdrawn, sold, expired, etc.
// Before copying, the file's first bytes are checked so only genuine
// JPEG/PNG/WebP images can ever become public.

const PRIVATE = "listing-photos";
const PUBLIC = "listing-photos-public";
const MAX_BYTES = 5 * 1024 * 1024;

export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

async function copyToPublic(admin: ReturnType<typeof createAdminClient>, path: string): Promise<boolean> {
  const { data, error } = await admin.storage.from(PRIVATE).download(path);
  if (error || !data) return false;
  const bytes = new Uint8Array(await data.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type || bytes.length > MAX_BYTES) {
    console.warn("Refused to publish a file that is not a valid image", { path });
    return false;
  }
  const upload = await admin.storage.from(PUBLIC).upload(path, bytes, { contentType: type, upsert: true });
  return !upload.error;
}

/** Makes a listing's public photos match its status. Safe to call repeatedly. */
export async function syncPublicPhotos(listingId: number): Promise<void> {
  const admin = createAdminClient();
  const [{ data: listing }, { data: images }] = await Promise.all([
    admin.from("listings").select("status").eq("id", listingId).maybeSingle(),
    admin.from("listing_images").select("id, storage_path, thumb_path, public_copied_at").eq("listing_id", listingId),
  ]);
  if (!images) return;

  if (listing?.status === "published") {
    for (const image of images.filter((i) => !i.public_copied_at)) {
      const mainOk = await copyToPublic(admin, image.storage_path);
      if (!mainOk) continue;
      if (image.thumb_path) await copyToPublic(admin, image.thumb_path);
      await admin.from("listing_images").update({ public_copied_at: new Date().toISOString() }).eq("id", image.id);
    }
    return;
  }

  const copied = images.filter((i) => i.public_copied_at);
  if (copied.length === 0) return;
  const paths = copied.flatMap((i) => [i.storage_path, i.thumb_path].filter((p): p is string => Boolean(p)));
  await admin.storage.from(PUBLIC).remove(paths);
  await admin
    .from("listing_images")
    .update({ public_copied_at: null })
    .in(
      "id",
      copied.map((i) => i.id),
    );
}

/** Re-syncs every listing of a seller (e.g. after an account deletion request). */
export async function syncSellerPhotos(sellerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("listings").select("id").eq("seller_id", sellerId);
  for (const { id } of data ?? []) await syncPublicPhotos(id);
}

/** Deletes a photo's files from both buckets (row deletion is done by the caller). */
export async function deletePhotoFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  await Promise.all([admin.storage.from(PRIVATE).remove(paths), admin.storage.from(PUBLIC).remove(paths)]);
}
