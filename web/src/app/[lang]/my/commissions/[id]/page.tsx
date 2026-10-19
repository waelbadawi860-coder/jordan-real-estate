import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RuleSummary } from "@/components/commission/rule-summary";
import { DisputeForm, ReportPaymentForm } from "@/components/commission/seller-forms";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { filsToString, toFils } from "@/lib/commission";
import { getCommissionDetail, toRule } from "@/lib/data/commission";
import { getReferenceData } from "@/lib/data/public";
import { formatDate, formatPrice, t } from "@/lib/format";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/commissions/[id]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).commission.title, robots: { index: false } };
}

function ammanToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
}

export default async function MyCommissionPage({ params }: PageProps<"/[lang]/my/commissions/[id]">) {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang) || !/^\d{1,15}$/.test(rawId)) notFound();
  const id = Number(rawId);
  const user = await requireUser(lang, `/my/commissions/${id}`);
  const [dict, detail, ref] = await Promise.all([getDictionary(lang), getCommissionDetail(id), getReferenceData()]);
  // RLS already hides other sellers' commissions; the explicit check keeps admins
  // from seeing seller-only forms on this page.
  if (!detail || detail.commission.seller_id !== user.id) notFound();

  const { commission: cm, payments, events } = detail;
  const c = dict.commission;
  const money = (v: number | string) => formatPrice(v, lang, dict.common.currency);
  const remainingFils = (toFils(String(cm.amount_due)) ?? 0n) - (toFils(String(cm.amount_verified)) ?? 0n);
  const remaining = remainingFils > 0n ? filsToString(remainingFils) : "0";
  const s = ref.settings;
  const text = (key: string) => (typeof s[key] === "string" ? (s[key] as string).trim() : "");
  const hasCliq = Boolean(text("payment_cliq_alias"));
  const hasBank = Boolean(text("payment_iban"));
  const canPay = ["reported", "not_yet_due", "pending", "payment_reported"].includes(cm.status);
  const canDispute = !["payment_verified", "waived", "disputed"].includes(cm.status);
  const box = "rounded-2xl border border-border bg-surface p-4";
  const rule = cm.commission_rules ? toRule(cm.commission_rules) : null;

  return (
    <div className="flex flex-col gap-4">
      <section className={box}>
        <h1 className="mb-1 text-xl font-extrabold" dir="auto">
          {(cm.listings as { title: string } | null)?.title}
        </h1>
        <p className="mb-3 text-sm text-muted">
          {c.reference}: <span className="font-bold text-foreground" dir="ltr">{cm.reference}</span>
        </p>
        <span className="rounded-md bg-accent-soft px-2 py-1 text-sm font-bold">{c.statuses[cm.status]}</span>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{c.amountDue}</dt>
          <dd className="font-extrabold">{money(cm.amount_due)}</dd>
          <dt className="text-muted">{c.verified}</dt>
          <dd>{money(cm.amount_verified)}</dd>
          <dt className="text-muted">{c.remaining}</dt>
          <dd className="font-bold">{money(remaining)}</dd>
          <dt className="text-muted">{c.dueDate}</dt>
          <dd>{formatDate(cm.due_date, lang)}</dd>
          <dt className="text-muted">{c.completedOn}</dt>
          <dd>{formatDate(cm.transaction_date, lang)}</dd>
          {cm.transaction_value !== null && rule && (
            <>
              <dt className="text-muted">{c.value[rule.basis]}</dt>
              <dd>{money(cm.transaction_value)}</dd>
            </>
          )}
        </dl>
        {rule && (
          <div className="mt-3">
            <h2 className="mb-1 text-sm font-bold">{c.rulesTitle}</h2>
            <RuleSummary rule={rule} dict={dict} locale={lang} />
          </div>
        )}
      </section>

      {canPay && (
        <section className={box} aria-labelledby="pay">
          <h2 id="pay" className="mb-2 text-lg font-extrabold">
            {c.payTitle}
          </h2>
          {hasCliq || hasBank ? (
            <>
              <p className="mb-3 text-sm">{t(c.payIntro, { ref: cm.reference })}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {hasCliq && (
                  <dl className="rounded-lg bg-background p-3 text-sm">
                    <dt className="font-bold">{c.cliq}</dt>
                    <dd>
                      {c.cliqAlias}: <span dir="ltr" className="font-bold">{text("payment_cliq_alias")}</span>
                    </dd>
                    {text("payment_cliq_holder") && (
                      <dd>
                        {c.holder}: {text("payment_cliq_holder")}
                      </dd>
                    )}
                  </dl>
                )}
                {hasBank && (
                  <dl className="rounded-lg bg-background p-3 text-sm">
                    <dt className="font-bold">{c.bank}</dt>
                    {text("payment_bank_name") && (
                      <dd>
                        {c.bankName}: {text("payment_bank_name")}
                      </dd>
                    )}
                    {text("payment_bank_account_name") && (
                      <dd>
                        {c.accountName}: {text("payment_bank_account_name")}
                      </dd>
                    )}
                    <dd>
                      {c.iban}: <span dir="ltr" className="break-all font-bold">{text("payment_iban")}</span>
                    </dd>
                  </dl>
                )}
              </div>
              {text(lang === "ar" ? "payment_note_ar" : "payment_note_en") && (
                <p className="mt-2 whitespace-pre-line text-sm">{text(lang === "ar" ? "payment_note_ar" : "payment_note_en")}</p>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold text-danger">{c.noPaymentDetails}</p>
          )}
          <h3 className="mb-2 mt-4 font-bold">{c.reportPaymentTitle}</h3>
          <ReportPaymentForm commissionId={cm.id} suggestedAmount={remaining} today={ammanToday()} c={c} />
        </section>
      )}

      {payments.length > 0 && (
        <section className={box} aria-labelledby="payments">
          <h2 id="payments" className="mb-2 text-lg font-extrabold">
            {c.payments}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {payments.map((p) => (
              <li key={p.id}>
                {formatDate(p.paid_on, lang)} · {c.methods[p.method as keyof typeof c.methods]} · {money(p.amount_reported)} ·{" "}
                <span className="font-bold">{c.paymentStatuses[p.status]}</span>
                {p.status === "verified" && p.verified_amount !== null && <> ({money(p.verified_amount)})</>}
                {p.status === "rejected" && p.rejection_reason && (
                  <span className="text-danger" dir="auto">
                    {" "}
                    — {p.rejection_reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canDispute && (
        <section className={box} aria-labelledby="dispute">
          <h2 id="dispute" className="mb-2 text-lg font-extrabold">
            {c.disputeTitle}
          </h2>
          <DisputeForm commissionId={cm.id} c={c} />
        </section>
      )}

      <section className={box} aria-labelledby="history">
        <h2 id="history" className="mb-2 text-lg font-extrabold">
          {c.history}
        </h2>
        <ol className="flex flex-col gap-1 text-sm">
          {events.map((e) => (
            <li key={e.id}>
              <span className="text-muted">{formatDate(e.created_at, lang)}</span> ·{" "}
              {(c.events as Record<string, string>)[e.event] ?? e.event}
              {e.to_status && <> → {c.statuses[e.to_status]}</>}
              {e.amount !== null && <> · {money(e.amount)}</>}
              {e.note && (
                <span className="text-muted" dir="auto">
                  {" "}
                  — {e.note}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
