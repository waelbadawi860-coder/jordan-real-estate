import { connection, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily photo clean-up, called by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; without that secret configured the
// job refuses to run. Removes orphaned uploads, stray public copies, and photo
// files of ads that left the site longer ago than the retention period.

export async function GET(request: Request) {
  await connection();
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  if (!cronAuthorized(request.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("photo_cleanup_candidates", { p_limit: 1000 });
  if (error) {
    console.error("cleanup: listing candidates failed", { message: error.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const removed: Record<string, number> = {};
  const byBucket = new Map<string, string[]>();
  for (const row of data ?? []) byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row.path]);
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (removeError) console.error("cleanup: remove failed", { bucket, message: removeError.message });
    }
  }
  for (const row of data ?? []) removed[row.reason] = (removed[row.reason] ?? 0) + 1;

  // Keep the photo rows (and fingerprints) of retention-expired ads; note the files are gone.
  const imageIds = [...new Set((data ?? []).flatMap((row) => (row.image_id ? [row.image_id] : [])))];
  if (imageIds.length) {
    await admin.from("listing_images").update({ files_removed_at: new Date().toISOString() }).in("id", imageIds);
  }

  console.log(JSON.stringify({ event: "photo_cleanup", removed }));
  return NextResponse.json({ ok: true, removed }, { headers: { "Cache-Control": "no-store" } });
}
