// Commission helpers usable in the browser and on the server.
// The OFFICIAL amount is always calculated by the database; this estimate is
// only for showing the seller a preview while they type. It uses whole fils
// (1 JOD = 1000 fils) as BigInt, so there are no floating-point rounding errors.

export type CommissionBasis = "sale_price" | "annual_rent" | "monthly_rent" | "fixed_amount";

export type CommissionRule = {
  id: number;
  dealType: "sale" | "rent";
  basis: CommissionBasis;
  percentage: string | null; // e.g. "2.5"
  fixedAmount: string | null; // e.g. "250.000"
  minAmount: string | null;
  maxAmount: string | null;
  dueDays: number;
  triggerEvent: "transaction_completed" | "contract_signed";
  agreementVersionId: number;
};

/** "125,000.5" → 125000500n fils; null if not a valid positive amount with ≤3 decimals. */
export function toFils(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/,/g, "").trim();
  if (!/^\d{1,12}(\.\d{1,3})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 1000n + BigInt(frac.padEnd(3, "0"));
}

export function filsToString(fils: bigint): string {
  const whole = fils / 1000n;
  const frac = (fils % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** Percentage like "2.5" → thousandths of a percent (2500n). */
function pctThousandths(pct: string): bigint | null {
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(pct.trim())) return null;
  const [w, f = ""] = pct.trim().split(".");
  return BigInt(w) * 1000n + BigInt(f.padEnd(3, "0"));
}

/** Same result as the database function commission_amount (round half away from zero). */
export function estimateCommission(rule: CommissionRule, transactionValue: string | null): string | null {
  let fils: bigint;
  if (rule.basis === "fixed_amount") {
    const fixed = toFils(rule.fixedAmount);
    if (fixed === null) return null;
    fils = fixed;
  } else {
    const value = toFils(transactionValue);
    const pct = rule.percentage ? pctThousandths(rule.percentage) : null;
    if (value === null || value <= 0n || pct === null) return null;
    // value(fils) * pct(thousandths of %) / (100 * 1000), rounded half up (values are positive).
    const numerator = value * pct;
    const divisor = 100_000n;
    fils = (numerator * 2n + divisor) / (divisor * 2n);
  }
  const min = toFils(rule.minAmount);
  const max = toFils(rule.maxAmount);
  if (min !== null && fils < min) fils = min;
  if (max !== null && fils > max) fils = max;
  return filsToString(fils);
}
