"use server";

import { z } from "zod";
import { searchListings, type ListingPage } from "@/lib/data/public";
import { withinVisitorLimit } from "@/lib/rate-limit";
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

export async function revealContact(listingId: unknown): Promise<ContactResult> {
  const id = z.number().int().positive().safeParse(listingId);
  if (!id.success) return { ok: false, reason: "unavailable" };

  try {
    if (!(await withinVisitorLimit("contact", CONTACT_REVEALS_PER_HOUR, 3600))) return { ok: false, reason: "limited" };

    // Returns a row only while the listing is published and unexpired.
    const { data, error } = await createAdminClient().rpc("get_listing_contact", { p_listing_id: id.data });
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
