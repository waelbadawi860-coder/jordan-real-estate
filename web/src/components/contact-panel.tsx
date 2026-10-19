"use client";

import { Loader2, MessageCircle, Phone } from "lucide-react";
import { useState, useTransition } from "react";
import { revealContact, type ContactResult } from "@/app/actions/public";
import { displayPhone, telUrl, whatsappUrl } from "@/lib/format";

/**
 * The phone number is NOT in the page HTML. It is fetched from the server only
 * when a visitor taps the button, and the server limits how often that can
 * happen, which protects sellers from number-harvesting bots.
 */
export function ContactPanel({
  listingId,
  whatsappMessage,
  text,
}: {
  listingId: number;
  whatsappMessage: string;
  text: {
    showNumber: string;
    call: string;
    whatsapp: string;
    contactLimited: string;
    contactUnavailable: string;
    contactError: string;
    loading: string;
  };
}) {
  const [result, setResult] = useState<ContactResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reveal() {
    startTransition(async () => {
      try {
        setResult(await revealContact(listingId));
      } catch {
        setResult({ ok: false, reason: "error" });
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-2xl font-extrabold tracking-wide" dir="ltr">
          {displayPhone(result.phone)}
        </p>
        {result.allowCalls && (
          <a
            href={telUrl(result.phone)}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand font-bold text-white hover:bg-brand-strong"
          >
            <Phone className="size-5" aria-hidden />
            {text.call}
          </a>
        )}
        {result.allowWhatsapp && (
          <a
            href={whatsappUrl(result.phone, whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-whatsapp font-bold text-white hover:opacity-90"
          >
            <MessageCircle className="size-5" aria-hidden />
            {text.whatsapp}
          </a>
        )}
      </div>
    );
  }

  const message =
    result && !result.ok
      ? result.reason === "limited"
        ? text.contactLimited
        : result.reason === "unavailable"
          ? text.contactUnavailable
          : text.contactError
      : null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={reveal}
        disabled={pending}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand font-bold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Phone className="size-5" aria-hidden />}
        {pending ? text.loading : text.showNumber}
      </button>
      <p role="status" className="min-h-5 text-center text-sm text-danger">
        {message}
      </p>
    </div>
  );
}
