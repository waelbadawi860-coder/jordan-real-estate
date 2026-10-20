"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Users may only set read_at on their own notifications (column grant + RLS).

export async function markNotificationReadAction(id: unknown): Promise<void> {
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data).is("read_at", null);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
}
