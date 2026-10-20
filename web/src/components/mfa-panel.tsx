"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";
import { FormMessage, inputClass } from "./form-controls";

type State =
  | { step: "loading" }
  | { step: "enrol" }
  | { step: "scan"; factorId: string; qr: string; secret: string }
  | { step: "challenge"; factorId: string }
  | { step: "active"; factorId: string };

/**
 * Two-step login with an authenticator app (Google Authenticator, Microsoft
 * Authenticator, 1Password…). Supabase keeps the secret; this page only shows
 * the QR code once and sends the 6-digit codes for checking.
 */
export function MfaPanel({ text, next }: { text: Dictionary["security"]; next: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: factors }, { data: level }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      const verified = factors?.totp.find((f) => f.status === "verified");
      if (!verified) setState({ step: "enrol" });
      else if (level?.currentLevel === "aal2") setState({ step: "active", factorId: verified.id });
      else setState({ step: "challenge", factorId: verified.id });
    })().catch(() => setError(text.error));
  }, [text.error]);

  function enrol() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      // Remove a half-finished earlier attempt, if any.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrolError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
      if (enrolError || !data) return setError(text.error);
      setState({ step: "scan", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    });
  }

  function verify(factorId: string) {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) return setError(text.codeInvalid);
    startTransition(async () => {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (verifyError) return setError(text.codeWrong);
      setCode("");
      setDone(true);
      setState({ step: "active", factorId });
      if (next) router.push(next);
      router.refresh();
    });
  }

  function remove(factorId: string) {
    if (!window.confirm(text.removeConfirm)) return;
    setError(null);
    startTransition(async () => {
      const { error: removeError } = await createClient().auth.mfa.unenroll({ factorId });
      if (removeError) return setError(text.error);
      await createClient().auth.refreshSession();
      setState({ step: "enrol" });
      router.refresh();
    });
  }

  const codeField = (factorId: string) => (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        verify(factorId);
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {text.codeLabel}
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={`${inputClass} sm:w-40`}
        />
      </label>
      <button type="submit" disabled={pending} className="h-12 rounded-lg bg-brand px-6 font-bold text-white hover:bg-brand-strong disabled:opacity-60">
        {text.verify}
      </button>
    </form>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {done && <FormMessage kind="success">{text.enabled}</FormMessage>}

      {state.step === "loading" && <p className="text-muted">…</p>}

      {state.step === "enrol" && (
        <>
          <p>{text.enrolIntro}</p>
          <button type="button" disabled={pending} onClick={enrol} className="h-12 w-fit rounded-lg bg-brand px-6 font-bold text-white hover:bg-brand-strong disabled:opacity-60">
            {text.enrol}
          </button>
        </>
      )}

      {state.step === "scan" && (
        <>
          <p>{text.scan}</p>
          {/* The QR code is an SVG data URL produced by Supabase. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt={text.qrAlt} width={200} height={200} className="rounded-lg border border-border bg-white p-2" />
          <p className="text-sm text-muted">
            {text.manualKey}: <code dir="ltr" className="break-all font-mono">{state.secret}</code>
          </p>
          {codeField(state.factorId)}
        </>
      )}

      {state.step === "challenge" && (
        <>
          <p>{text.challenge}</p>
          {codeField(state.factorId)}
        </>
      )}

      {state.step === "active" && (
        <>
          <p className="font-semibold">{text.active}</p>
          <button type="button" disabled={pending} onClick={() => remove(state.factorId)} className="w-fit text-sm font-semibold text-danger underline">
            {text.remove}
          </button>
        </>
      )}
    </div>
  );
}
