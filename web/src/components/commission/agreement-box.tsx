import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { CommissionRule } from "@/lib/commission";
import type { AgreementVersion } from "@/lib/data/commission";
import { RuleSummary } from "./rule-summary";

/** The agreement text and the rule that would apply, shown before acceptance. */
export function AgreementBox({
  agreement,
  rule,
  locale,
  dict,
  intro,
  children,
}: {
  agreement: AgreementVersion;
  rule: CommissionRule | null;
  locale: Locale;
  dict: Dictionary;
  intro?: string;
  children?: ReactNode;
}) {
  const c = dict.commission;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-brand/40 bg-surface p-4" aria-labelledby="agreement-title">
      <h2 id="agreement-title" className="text-lg font-extrabold">
        {c.agreementTitle}: {agreement.title[locale]}
      </h2>
      {intro && <p className="text-sm">{intro}</p>}
      {agreement.isDraft && (
        <p role="note" className="rounded-lg bg-accent-soft p-2 text-sm font-bold text-accent">
          {c.draftBanner}
        </p>
      )}
      <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded-lg border border-border bg-background p-3 text-sm leading-relaxed" tabIndex={0}>
        {agreement.body[locale]}
      </div>
      {rule && (
        <div>
          <h3 className="mb-1 font-bold">{c.rulesTitle}</h3>
          <RuleSummary rule={rule} dict={dict} locale={locale} />
        </div>
      )}
      <p className="text-xs text-muted" dir="ltr">
        {agreement.label}
      </p>
      {children}
    </section>
  );
}
