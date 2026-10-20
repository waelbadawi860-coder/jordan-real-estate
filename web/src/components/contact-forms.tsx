"use client";

import { useActionState, useState, useTransition } from "react";
import { reportListingAction, type ContactFormState } from "@/app/actions/contact";
import type { Dictionary } from "@/i18n/dictionaries";
import { t } from "@/lib/format";
import { FormMessage, inputClass, keepValuesOnSubmit, SubmitButton } from "./form-controls";

const label = "mb-1 block text-sm font-semibold";

function errorText(c: Dictionary["contact"], error?: ContactFormState["error"]) {
  return error ? (c[error] ?? c.generic) : null;
}

function Sent({ text, reference, c }: { text: string; reference?: string; c: Dictionary["contact"] }) {
  return (
    <FormMessage kind="success">
      {text}
      {reference && (
        <>
          <br />
          <strong>{t(c.reference, { ref: reference })}</strong>
        </>
      )}
    </FormMessage>
  );
}

export function ReportListingForm({ listingId, dict }: { listingId: number; dict: Pick<Dictionary, "contact" | "reportReasons"> }) {
  const [state, action, pending] = useActionState(reportListingAction, {});
  const [, startTransition] = useTransition();
  const [target, setTarget] = useState<"listing" | "seller">("listing");
  const c = dict.contact;
  if (state.ok) return <Sent text={c.reportSent} reference={state.reference} c={c} />;

  const reasons =
    target === "listing"
      ? (["fraud", "wrong_info", "duplicate", "already_sold", "inappropriate", "other"] as const).map((r) => [r, dict.reportReasons[r]])
      : (["fraud", "spam", "harassment", "impersonation", "other"] as const).map((r) => [r, c.sellerReasons[r]]);
  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      {state.error && <FormMessage kind="error">{errorText(c, state.error)}</FormMessage>}
      <fieldset className="flex flex-col gap-1">
        <legend className={label}>{c.reportTarget}</legend>
        <div className="flex flex-wrap gap-4">
          {(["listing", "seller"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="target"
                value={value}
                checked={target === value}
                onChange={() => setTarget(value)}
                className="size-5 accent-brand"
              />
              {value === "listing" ? c.targetListing : c.targetSeller}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="reason" className={label}>
          {c.reason}
        </label>
        <select key={target} id="reason" name="reason" required className={inputClass} defaultValue="">
          <option value="" disabled>
            …
          </option>
          {reasons.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="details" className={label}>
          {c.details}
        </label>
        <textarea id="details" name="details" maxLength={1000} rows={4} dir="auto" className="w-full rounded-lg border border-border bg-surface p-3" />
      </div>
      <div className="sm:w-60">
        <SubmitButton pendingText={c.sending} pending={pending}>
          {c.send}
        </SubmitButton>
      </div>
    </form>
  );
}
