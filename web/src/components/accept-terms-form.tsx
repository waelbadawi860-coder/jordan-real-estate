"use client";

import { useActionState } from "react";
import { acceptTermsAction, type ConsentFormState } from "@/app/actions/consent";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { FormMessage, SubmitButton } from "./form-controls";

const initial: ConsentFormState = {};

export function AcceptTermsForm({ locale, next, c }: { locale: Locale; next: string; c: Dictionary["consent"] }) {
  const [state, action, pending] = useActionState(acceptTermsAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={next} />
      {state.error && <FormMessage kind="error">{state.error === "termsRequired" ? c.required : c.failed}</FormMessage>}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-1 size-5 accent-brand" />
        <span>{c.checkbox}</span>
      </label>
      <SubmitButton pendingText={c.accept + "…"} pending={pending}>
        {c.accept}
      </SubmitButton>
    </form>
  );
}
