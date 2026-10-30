import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SystemEventKind = "server_error" | "photo_upload_failed" | "photo_publish_refused" | "listing_save_failed" | "job_failed";

/**
 * Records a failure for the admin dashboard (and the hourly alert). Never
 * throws: monitoring must not break the page it is watching. Pass only
 * technical details (error codes, route names), never personal data.
 */
export async function recordSystemEvent(kind: SystemEventKind, source: string, detail?: string | null): Promise<void> {
  try {
    await createAdminClient().rpc("record_system_event", {
      p_kind: kind,
      p_source: source.slice(0, 120),
      p_detail: detail ? detail.slice(0, 300) : undefined,
    });
  } catch {
    // The hosting logs still have the error line.
  }
}
