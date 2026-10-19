"use client";

import { useActionState, useState, useTransition } from "react";
import { reportTransactionAction, type CommissionFormState } from "@/app/actions/commission";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { estimateCommission, type CommissionRule } from "@/lib/commission";
import { formatPrice, t } from "@/lib/format";
import { FormMessage, inputClass, keepValuesOnSubmit, SubmitButton } from "../form-controls";

export function TransactionForm({
  listingId,
  rule,
  today,
  locale,
  dict,
}: {
  listingId: number;
  rule: CommissionRule;
  today: string;
  locale: Locale;
  dict: Pick<Dictionary, "commission" | "common">;
}) {
  const c = dict.commission;
  const [state, action, pending] = useActionState(reportTransactionAction.bind(null, listingId), {} as CommissionFormState);
  const [, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const needsValue = rule.basis !== "fixed_amount";
  const estimate = estimateCommission(rule, needsValue ? value : null);

  return (
    <form onSubmit={keepValuesOnSubmit(action, startTransition)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="lang" value={locale} />
      {state.error && <FormMessage kind="error">{(c.errors as Record<string, string>)[state.error] ?? c.errors.generic}</FormMessage>}
      <div className="sm:w-1/2">
        <label htmlFor="completedOn" className="mb-1 block text-sm font-semibold">
          {c.completedOn}
        </label>
        <input id="completedOn" name="completedOn" type="date" max={today} required className={inputClass} />
      </div>
      {needsValue && (
        <div className="sm:w-1/2">
          <label htmlFor="transactionValue" className="mb-1 block text-sm font-semibold">
            {c.value[rule.basis]}
          </label>
          <input
            id="transactionValue"
            name="transactionValue"
            inputMode="decimal"
            dir="ltr"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
      {estimate && (
        <p role="status" className="rounded-lg bg-brand-soft p-3 font-bold text-brand-strong">
          {t(c.estimate, { amount: formatPrice(estimate, locale, dict.common.currency) })}
        </p>
      )}
      <label className="flex items-start gap-2 font-semibold">
        <input type="checkbox" name="confirm" className="mt-1 size-5 shrink-0 accent-brand" />
        {c.confirm}
      </label>
      <div className="sm:w-60">
        <SubmitButton pendingText={c.submit + "…"} pending={pending}>
          {c.submit}
        </SubmitButton>
      </div>
    </form>
  );
}
