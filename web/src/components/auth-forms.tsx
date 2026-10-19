"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  updatePasswordAction,
  type AuthFormState,
} from "@/app/actions/auth";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { FormMessage, keepValuesOnSubmit, SubmitButton, TextField } from "./form-controls";

type AuthText = Dictionary["auth"];
const initial: AuthFormState = {};

function errorText(a: AuthText, key?: string): string | undefined {
  if (!key) return undefined;
  return (a.errors as Record<string, string>)[key] ?? a.errors.generic;
}

export function LoginForm({ locale, a, next, notice }: { locale: Locale; a: AuthText; next: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const [, startTransition] = useTransition();
  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={next} />
      {notice && <FormMessage kind="info">{notice}</FormMessage>}
      {state.error && <FormMessage kind="error">{errorText(a, state.error)}</FormMessage>}
      <TextField id="email" name="email" type="email" autoComplete="email" dir="ltr" required label={a.email} />
      <TextField id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required label={a.password} />
      <SubmitButton pendingText={a.loginButton + "…"} pending={pending}>{a.loginButton}</SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href={localePath(locale, "/forgot-password")} className="font-semibold text-brand hover:underline">
          {a.forgot}
        </Link>
        <span>
          {a.noAccount}{" "}
          <Link href={localePath(locale, "/register")} className="font-bold text-brand hover:underline">
            {a.registerTitle}
          </Link>
        </span>
      </div>
    </form>
  );
}

export function RegisterForm({ locale, a, links }: { locale: Locale; a: AuthText; links: { terms: string; privacy: string } }) {
  const [state, action, pending] = useActionState(registerAction, initial);
  const [, startTransition] = useTransition();
  const fe = state.fieldErrors ?? {};

  if (state.success) {
    return <FormMessage kind="success">{a.checkEmail}</FormMessage>;
  }

  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="lang" value={locale} />
      {state.error && <FormMessage kind="error">{errorText(a, state.error)}</FormMessage>}
      <TextField
        id="displayName"
        name="displayName"
        autoComplete="name"
        required
        maxLength={60}
        label={a.displayName}
        hint={a.displayNameHint}
        error={errorText(a, fe.displayName)}
      />
      <TextField id="email" name="email" type="email" autoComplete="email" dir="ltr" required label={a.email} error={errorText(a, fe.email)} />
      <TextField
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        required
        minLength={8}
        label={a.password}
        hint={a.passwordHint}
        error={errorText(a, fe.password)}
      />
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-1 size-5 accent-brand"
            aria-invalid={fe.acceptTerms ? true : undefined}
            aria-describedby={fe.acceptTerms ? "terms-error" : undefined}
          />
          <span>
            {a.acceptPrefix}{" "}
            <Link href={localePath(locale, "/terms")} target="_blank" className="font-semibold text-brand underline">
              {links.terms}
            </Link>{" "}
            {/* Arabic "و" (and) attaches to the next word; English needs a space. */}
            {a.and}
            {locale === "en" ? " " : ""}
            <Link href={localePath(locale, "/privacy")} target="_blank" className="font-semibold text-brand underline">
              {links.privacy}
            </Link>
          </span>
        </label>
        {fe.acceptTerms && (
          <p id="terms-error" className="mt-1 text-sm font-semibold text-danger">
            {errorText(a, fe.acceptTerms)}
          </p>
        )}
      </div>
      <SubmitButton pendingText={a.registerButton + "…"} pending={pending}>{a.registerButton}</SubmitButton>
      <p className="text-sm">
        {a.haveAccount}{" "}
        <Link href={localePath(locale, "/login")} className="font-bold text-brand hover:underline">
          {a.loginTitle}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm({ locale, a, linkError }: { locale: Locale; a: AuthText; linkError: boolean }) {
  const [state, action] = useActionState(requestPasswordResetAction, initial);
  if (state.success) return <FormMessage kind="success">{a.resetSent}</FormMessage>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="lang" value={locale} />
      {linkError && <FormMessage kind="error">{a.linkInvalid}</FormMessage>}
      {state.error && <FormMessage kind="error">{errorText(a, state.error)}</FormMessage>}
      <p className="text-muted">{a.forgotText}</p>
      <TextField
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        dir="ltr"
        required
        label={a.email}
        error={errorText(a, state.fieldErrors?.email)}
      />
      <SubmitButton pendingText={a.sendLink + "…"}>{a.sendLink}</SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ a, label }: { a: AuthText; label?: string }) {
  const [state, action] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.success && <FormMessage kind="success">{a.passwordUpdated}</FormMessage>}
      {state.error && <FormMessage kind="error">{errorText(a, state.error)}</FormMessage>}
      <TextField
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        required
        minLength={8}
        label={label ?? a.newPassword}
        hint={a.passwordHint}
        error={errorText(a, state.fieldErrors?.password)}
      />
      <SubmitButton pendingText={a.save + "…"}>{a.save}</SubmitButton>
    </form>
  );
}
