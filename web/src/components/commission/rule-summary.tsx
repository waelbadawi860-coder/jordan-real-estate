import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { CommissionRule } from "@/lib/commission";
import { formatPrice, t } from "@/lib/format";

/** Plain-language lines describing a commission rule. */
export function ruleLines(rule: CommissionRule, c: Dictionary["commission"], locale: Locale, currency: string): string[] {
  const money = (v: string) => formatPrice(v, locale, currency);
  const lines = [
    rule.basis === "fixed_amount"
      ? t(c.basis.fixed_amount, { amount: money(rule.fixedAmount ?? "0") })
      : t(c.basis[rule.basis], { pct: rule.percentage ?? "" }),
  ];
  if (rule.minAmount) lines.push(t(c.min, { amount: money(rule.minAmount) }));
  if (rule.maxAmount) lines.push(t(c.max, { amount: money(rule.maxAmount) }));
  lines.push(c.triggers[rule.triggerEvent]);
  lines.push(rule.dueDays > 0 ? t(c.dueDays, { days: rule.dueDays }) : c.dueNow);
  return lines;
}

export function RuleSummary({ rule, dict, locale }: { rule: CommissionRule; dict: Dictionary; locale: Locale }) {
  return (
    <ul className="list-inside list-disc text-sm">
      {ruleLines(rule, dict.commission, locale, dict.common.currency).map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
