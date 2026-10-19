"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptAndSubmitAction } from "@/app/actions/commission";
import type { Dictionary } from "@/i18n/dictionaries";
import { FormMessage } from "../form-controls";

/** Affirmative acceptance: the box must be ticked by the seller; nothing is pre-ticked. */
export function AcceptAndSubmit({
  listingId,
  requireApproval,
  dict,
}: {
  listingId: number;
  requireApproval: boolean;
  dict: Pick<Dictionary, "commission" | "preview">;
}) {
  const c = dict.commission;
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit() {
    if (!accepted) {
      setMessage({ ok: false, text: c.mustAccept });
      return;
    }
    startTransition(async () => {
      const result = await acceptAndSubmitAction(listingId, true);
      if (result.ok) {
        setMessage({ ok: true, text: result.published ? dict.preview.published : dict.preview.submitted });
        router.refresh();
      } else {
        const errors = c.errors as Record<string, string>;
        const text =
          result.error === "contact_required"
            ? dict.preview.needContact
            : result.error === "images_required"
              ? dict.preview.needPhotos
              : result.error === "mustAccept"
                ? c.mustAccept
                : (errors[result.error] ?? c.errors.generic);
        setMessage({ ok: false, text });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 font-semibold">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 size-5 shrink-0 accent-brand" />
        {c.acceptLabel}
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="h-12 w-fit rounded-lg bg-brand px-6 font-bold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {requireApproval ? c.acceptAndSubmit : c.acceptAndPublish}
      </button>
      {message && <FormMessage kind={message.ok ? "success" : "error"}>{message.text}</FormMessage>}
    </div>
  );
}
