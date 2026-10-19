"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { searchListings, type ListingPage } from "@/lib/data/public";
import { getServerEnv } from "@/lib/env";
import { cursorSchema, sanitizeFilters } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

// Server Actions are public endpoints: every input is validated again here.

export async function loadMoreListings(filters: unknown, cursor: unknown): Promise<ListingPage> {
  const parsedCursor = cursorSchema.safeParse(cursor);
  if (!parsedCursor.success) return { items: [], nextCursor: null };
  return searchListings(sanitizeFilters(filters), parsedCursor.data);
}

export type ContactResult =
  | { ok: true; phone: string; allowCalls: boolean; allowWhatsapp: boolean }
  | { ok: false; reason: "limited" | "unavailable" | "error" };

const CONTACT_REVEALS_PER_HOUR = 30;

/** Anonymous, non-reversible key for the visitor's IP address. */
async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  return createHmac("sha256", getServerEnv().SUPABASE_SECRET_KEY).update(ip).digest("base64url").slice(0, 32);
}

export async function revealContact(listingId: unknown): Promise<ContactResult> {
  const id = z.number().int().positive().safeParse(listingId);
  if (!id.success) return { ok: false, reason: "unavailable" };

  try {
    const admin = createAdminClient();
    const allowed = await admin.rpc("check_rate_limit", {
      p_key: `contact:${await visitorKey()}`,
      p_max: CONTACT_REVEALS_PER_HOUR,
      p_window_seconds: 3600,
    });
    if (allowed.error) throw allowed.error;
    if (!allowed.data) return { ok: false, reason: "limited" };

    // Returns a row only while the listing is published and unexpired.
    const { data, error } = await admin.rpc("get_listing_contact", { p_listing_id: id.data });
    if (error) throw error;
    const contact = data?.[0];
    if (!contact) return { ok: false, reason: "unavailable" };

    return {
      ok: true,
      phone: contact.phone,
      allowCalls: contact.allow_calls,
      allowWhatsapp: contact.allow_whatsapp,
    };
  } catch (error) {
    // Log without personal data.
    console.error("revealContact failed", { listingId: id.data, message: (error as Error).message });
    return { ok: false, reason: "error" };
  }
}
