import { connection, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Uptime check for a monitoring service (e.g. UptimeRobot): returns 200 when
// the site and the database respond, 503 otherwise. Reveals no data.
export async function GET() {
  await connection();
  const started = Date.now();
  try {
    const { error } = await createAdminClient().from("site_settings").select("key", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
