"use client";

import { useActionState, useTransition } from "react";
import { reportListingAction, sendContactMessageAction, type ContactFormState } from "@/app/actions/contact";
import type { Dictionary } from "@/i18n/dictionaries";
import { FormMessage, inputClass, keepValuesOnSubmit, SubmitButton } from "./form-controls";

const label = "mb-1 block text-sm font-semibold";

function errorText(c: Dictionary["contact"], error?: ContactFormState["error"]) {
  return error ? (c[error] ?? c.generic) : null;
}

export function ReportListingForm({ listingId, dict }: { listingId: number; dict: Pick<Dictionary, "contact" | "reportReasons"> }) {
  const [state, action, pending] = useActionState(reportListingAction, {});
  const [, startTransition] = useTransition();
  const c = dict.contact;
  if (state.ok) return <FormMessage kind="success">{c.reportSent}</FormMessage>;

  const reasons = ["fraud", "wrong_info", "duplicate", "already_sold", "inappropriate", "other"] as const;
  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      {state.error && <FormMessage kind="error">{errorText(c, state.error)}</FormMessage>}
      <div>
        <label htmlFor="reason" className={label}>
          {c.reason}
        </label>
        <select id="reason" name="reason" required className={inputClass} defaultValue="">
          <option value="" disabled>
            …
          </option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {dict.reportReasons[r]}
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

export function ContactMessageForm({ dict }: { dict: Pick<Dictionary, "contact"> }) {
  const [state, action, pending] = useActionState(sendContactMessageAction, {});
  const [, startTransition] = useTransition();
  const c = dict.contact;
  if (state.ok) return <FormMessage kind="success">{c.sent}</FormMessage>;

  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      {state.error && <FormMessage kind="error">{errorText(c, state.error)}</FormMessage>}
      {/* Hidden from people; bots that fill every field are rejected. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div>
        <label htmlFor="topic" className={label}>
          {c.topic}
        </label>
        <select id="topic" name="topic" className={inputClass} defaultValue="general">
          {(["general", "problem", "privacy", "account"] as const).map((t) => (
            <option key={t} value={t}>
              {c.topics[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={label}>
            {c.name}
          </label>
          <input id="name" name="name" maxLength={80} autoComplete="name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className={label}>
            {c.email}
          </label>
          <input id="email" name="email" type="email" maxLength={254} autoComplete="email" dir="ltr" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="message" className={label}>
          {c.message}
        </label>
        <textarea id="message" name="message" required minLength={5} maxLength={3000} rows={6} dir="auto" className="w-full rounded-lg border border-border bg-surface p-3" />
      </div>
      <div className="sm:w-60">
        <SubmitButton pendingText={c.sending} pending={pending}>
          {c.send}
        </SubmitButton>
      </div>
    </form>
  );
}
