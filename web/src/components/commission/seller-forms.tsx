"use client";

import { useActionState, useTransition } from "react";
import { openDisputeAction, reportPaymentAction, type CommissionFormState } from "@/app/actions/commission";
import type { Dictionary } from "@/i18n/dictionaries";
import { FormMessage, inputClass, keepValuesOnSubmit, SubmitButton } from "../form-controls";

type C = Dictionary["commission"];
const label = "mb-1 block text-sm font-semibold";

function errorText(c: C, key?: string) {
  return key ? ((c.errors as Record<string, string>)[key] ?? c.errors.generic) : null;
}

export function ReportPaymentForm({ commissionId, suggestedAmount, today, c }: { commissionId: number; suggestedAmount: string; today: string; c: C }) {
  const [state, action, pending] = useActionState(reportPaymentAction.bind(null, commissionId), {} as CommissionFormState);
  const [, startTransition] = useTransition();
  if (state.ok) return <FormMessage kind="success">{c.paymentReported}</FormMessage>;
  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-3" noValidate>
      {state.error && <FormMessage kind="error">{errorText(c, state.error)}</FormMessage>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="method" className={label}>
            {c.method}
          </label>
          <select id="method" name="method" className={inputClass} defaultValue="cliq">
            {(["cliq", "bank_transfer", "other"] as const).map((m) => (
              <option key={m} value={m}>
                {c.methods[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="amount" className={label}>
            {c.amount}
          </label>
          <input id="amount" name="amount" inputMode="decimal" dir="ltr" defaultValue={suggestedAmount} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="paidOn" className={label}>
            {c.paidOn}
          </label>
          <input id="paidOn" name="paidOn" type="date" max={today} defaultValue={today} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="reference" className={label}>
            {c.payerReference}
          </label>
          <input id="reference" name="reference" maxLength={100} dir="ltr" className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-muted">{c.paymentNote}</p>
      <div className="sm:w-60">
        <SubmitButton pendingText={c.reportPayment + "…"} pending={pending}>
          {c.reportPayment}
        </SubmitButton>
      </div>
    </form>
  );
}

export function DisputeForm({ commissionId, c }: { commissionId: number; c: C }) {
  const [state, action, pending] = useActionState(openDisputeAction.bind(null, commissionId), {} as CommissionFormState);
  const [, startTransition] = useTransition();
  if (state.ok) return <FormMessage kind="success">{c.disputeOpened}</FormMessage>;
  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-3" noValidate>
      {state.error && <FormMessage kind="error">{errorText(c, state.error)}</FormMessage>}
      <p className="text-sm text-muted">{c.disputeIntro}</p>
      <label htmlFor="reason" className="text-sm font-semibold">
        {c.disputeReason}
      </label>
      <textarea id="reason" name="reason" minLength={10} maxLength={2000} rows={4} required dir="auto" className="rounded-lg border border-border bg-surface p-3" />
      <button type="submit" disabled={pending} className="h-11 w-fit rounded-lg border-2 border-danger px-5 font-bold text-danger hover:bg-danger/5 disabled:opacity-60">
        {c.openDispute}
      </button>
    </form>
  );
}
