import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// One-click unsubscribe (RFC 8058): mail apps POST here when the reader
// presses "Unsubscribe". The token in the address identifies the follow.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(token)) return NextResponse.json({ ok: false }, { status: 400 });
  const sb = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sb.rpc("unsubscribe_saved_search", { p_token: token });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
