"use client";

import { useActionState, useTransition } from "react";
import { requestDeletionAction, updateProfileAction, type AccountFormState } from "@/app/actions/account";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { displayPhone } from "@/lib/format";
import { FormMessage, inputClass, keepValuesOnSubmit, SubmitButton, TextField } from "./form-controls";

export function ProfileForm({
  dict,
  profile,
}: {
  dict: Pick<Dictionary, "account" | "auth" | "form">;
  profile: { displayName: string; phone: string | null; preferredLanguage: Locale };
}) {
  const [state, action, pending] = useActionState(updateProfileAction, {} as AccountFormState);
  const [, startTransition] = useTransition();
  const fe = state.fieldErrors ?? {};
  const err = (key?: string) =>
    key ? ((dict.auth.errors as Record<string, string>)[key] ?? (dict.form.errors as Record<string, string>)[key]) : undefined;

  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      {state.success && <FormMessage kind="success">{dict.account.saved}</FormMessage>}
      {state.error && <FormMessage kind="error">{err(state.error) ?? dict.auth.errors.generic}</FormMessage>}
      <TextField
        id="displayName"
        name="displayName"
        defaultValue={profile.displayName}
        maxLength={60}
        required
        label={dict.auth.displayName}
        hint={dict.auth.displayNameHint}
        error={err(fe.displayName)}
      />
      <TextField
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        dir="ltr"
        defaultValue={profile.phone ? displayPhone(profile.phone).replace(/\s/g, "") : ""}
        placeholder="0791234567"
        label={dict.account.phone}
        hint={dict.account.phoneHint}
        error={err(fe.phone)}
      />
      <div>
        <label htmlFor="preferredLanguage" className="mb-1 block text-sm font-semibold">
          {dict.account.language}
        </label>
        <select id="preferredLanguage" name="preferredLanguage" defaultValue={profile.preferredLanguage} className={inputClass}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="sm:w-60">
        <SubmitButton pendingText={dict.form.saving} pending={pending}>{dict.account.save}</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ locale, dict }: { locale: Locale; dict: Pick<Dictionary, "account"> }) {
  return (
    <form
      action={requestDeletionAction}
      onSubmit={(e) => {
        if (!window.confirm(dict.account.deleteConfirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="lang" value={locale} />
      <p className="mb-3 text-sm text-muted">{dict.account.deleteText}</p>
      <button type="submit" className="h-11 rounded-lg border-2 border-danger px-5 font-bold text-danger hover:bg-danger/5">
        {dict.account.deleteButton}
      </button>
    </form>
  );
}
