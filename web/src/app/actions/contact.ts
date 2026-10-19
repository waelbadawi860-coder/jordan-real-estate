"use server";

import { z } from "zod";
import { getListing } from "@/lib/data/public";
import { withinVisitorLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Public forms: anyone may send them, so they are validated here, limited per
// visitor, and written by trusted server code (visitors can't write directly).

export type ContactFormState = { ok?: boolean; error?: "invalid" | "limited" | "alreadyReported" | "listingUnavailable" | "generic" };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

const reportSchema = z.object({
  listingId: z.coerce.number().int().positive(),
  reason: z.enum(["fraud", "wrong_info", "duplicate", "already_sold", "inappropriate", "other"]),
  details: z.string().trim().max(1000).default(""),
});

export async function reportListingAction(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const parsed = reportSchema.safeParse({
    listingId: formData.get("listingId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    if (!(await withinVisitorLimit("report", 10, 3600))) return { error: "limited" };
    if (!(await getListing(parsed.data.listingId))) return { error: "listingUnavailable" };

    const reporterId = await currentUserId();
    const { error } = await createAdminClient().from("listing_reports").insert({
      listing_id: parsed.data.listingId,
      reporter_id: reporterId,
      reason: parsed.data.reason,
      details: parsed.data.details || null,
    });
    if (error?.code === "23505") return { error: "alreadyReported" };
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error("reportListing failed", { message: (error as Error).message });
    return { error: "generic" };
  }
}

const messageSchema = z.object({
  topic: z.enum(["general", "problem", "privacy", "account"]),
  name: z.string().trim().max(80).default(""),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).default(""),
  message: z.string().trim().min(5).max(3000),
  website: z.string().max(0).default(""), // honeypot: real people leave this hidden field empty
});

export async function sendContactMessageAction(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const parsed = messageSchema.safeParse({
    topic: formData.get("topic"),
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  try {
    if (!(await withinVisitorLimit("message", 5, 3600))) return { error: "limited" };
    const { error } = await createAdminClient().from("contact_messages").insert({
      user_id: await currentUserId(),
      topic: parsed.data.topic,
      name: parsed.data.name || null,
      email: parsed.data.email || null,
      message: parsed.data.message,
    });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error("sendContactMessage failed", { message: (error as Error).message });
    return { error: "generic" };
  }
}
