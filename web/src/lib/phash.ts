import "server-only";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 64-bit "difference hash" of an image: shrink to 9×8 grey pixels and record
 * whether each pixel is brighter than its right-hand neighbour. Copies of the
 * same photo (resized, re-compressed) give the same or a very close hash; the
 * database compares hashes when an ad is submitted.
 */
export async function differenceHash(image: Uint8Array): Promise<string> {
  const pixels = await sharp(image).rotate().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? "1" : "0";
  }
  return bits;
}

/** Stores the fingerprint of an uploaded photo. Best effort: a failure never blocks the upload. */
export async function storePhotoHash(storagePath: string, thumbPath: string | null): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from("listing-photos").download(thumbPath ?? storagePath);
    if (error || !data) return;
    const hash = await differenceHash(new Uint8Array(await data.arrayBuffer()));
    await admin.from("listing_images").update({ phash: hash }).eq("storage_path", storagePath);
  } catch (error) {
    console.error("Photo fingerprint failed", { message: (error as Error).message });
  }
}
