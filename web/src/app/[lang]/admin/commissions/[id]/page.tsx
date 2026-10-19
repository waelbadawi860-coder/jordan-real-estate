import Link from "next/link";
import { notFound } from "next/navigation";
import { CommissionControls, PaymentReview } from "@/components/admin/commission-controls";
import { RuleSummary } from "@/components/commission/rule-summary";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { getCommissionDetail, toRule } from "@/lib/data/commission";
import { formatDate, formatPrice } from "@/lib/format";

export const instant = false;

export default async function AdminCommissionPage({ params }: PageProps<"/[lang]/admin/commissions/[id]">) {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang) || !/^\d{1,15}$/.test(rawId)) notFound();
  const id = Number(rawId);
  await requireAdminPage(lang, `/admin/commissions/${id}`);
  const [dict, detail] = await Promise.all([getDictionary(lang), getCommissionDetail(id)]);
  if (!detail) notFound();

  const { commission: cm, payments, events } = detail;
  const k = dict.admin.commissions;
  const c = dict.commission;
  const money = (v: number | string) => formatPrice(v, lang, dict.common.currency);
  const acceptance = cm.accepted_agreements as { accepted_at: string; agreement_versions: { version_label: string; is_draft: boolean } | null } | null;
  const rule = cm.commission_rules ? toRule(cm.commission_rules) : null;
  const box = "rounded-2xl border border-border bg-surface p-4";

  return (
    <div className="flex flex-col gap-4">
      <section className={box}>
        <h2 className="text-xl font-extrabold" dir="ltr">
          {cm.reference}
        </h2>
        <p className="mb-2">
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-sm font-bold">{c.statuses[cm.status]}</span>
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{c.listing}</dt>
          <dd>
            <Link href={localePath(lang, `/admin/listings/${cm.listing_id}`)} className="text-brand hover:underline" dir="auto">
              #{cm.listing_id} · {(cm.listings as { title: string } | null)?.title}
            </Link>
          </dd>
          <dt className="text-muted">{k.seller}</dt>
          <dd>
            <Link href={localePath(lang, `/admin/users/${cm.seller_id}`)} className="text-brand hover:underline">
              {dict.admin.listing.viewSeller}
            </Link>
          </dd>
          <dt className="text-muted">{k.transactionDate}</dt>
          <dd>{formatDate(cm.transaction_date, lang)}</dd>
          <dt className="text-muted">{k.transactionValue}</dt>
          <dd>{cm.transaction_value !== null ? money(cm.transaction_value) : "—"}</dd>
          <dt className="text-muted">{k.calculated}</dt>
          <dd>{money(cm.calculated_amount)}</dd>
          <dt className="text-muted">{c.amountDue}</dt>
          <dd className="font-extrabold">{money(cm.amount_due)}</dd>
          <dt className="text-muted">{c.verified}</dt>
          <dd className="font-bold text-brand-strong">{money(cm.amount_verified)}</dd>
          <dt className="text-muted">{c.dueDate}</dt>
          <dd>{formatDate(cm.due_date, lang)}</dd>
          <dt className="text-muted">{k.agreement}</dt>
          <dd dir="ltr" className="text-start">
            {acceptance?.agreement_versions?.version_label}
            {acceptance?.agreement_versions?.is_draft ? ` (${dict.admin.agreements.draft})` : ""}
          </dd>
          <dt className="text-muted">{k.acceptedAt}</dt>
          <dd>{acceptance ? formatDate(acceptance.accepted_at, lang) : "—"}</dd>
        </dl>
        {rule && (
          <div className="mt-3">
            <h3 className="mb-1 text-sm font-bold">{k.rule}</h3>
            <RuleSummary rule={rule} dict={dict} locale={lang} />
          </div>
        )}
        {cm.dispute_reason && (
          <p className="mt-3 rounded-lg bg-danger/5 p-2 text-sm" dir="auto">
            <span className="font-bold">{k.disputeReason}:</span> {cm.dispute_reason}
          </p>
        )}
        {cm.admin_note && (
          <p className="mt-2 text-sm text-muted" dir="auto">
            <span className="font-bold">{k.adminNote}:</span> {cm.admin_note}
          </p>
        )}
      </section>

      <CommissionControls id={cm.id} status={cm.status} a={dict.admin} c={c} />

      <section className={box}>
        <h3 className="mb-2 font-extrabold">{c.payments}</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">{dict.admin.reports.none}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0">
                <p className="text-sm">
                  {c.methods[p.method as keyof typeof c.methods]} · {money(p.amount_reported)} · {formatDate(p.paid_on, lang)}
                  {p.payer_reference && <span dir="ltr"> · {p.payer_reference}</span>} ·{" "}
                  <span className="font-bold">{c.paymentStatuses[p.status]}</span>
                  {p.status === "verified" && (
                    <>
                      {" "}
                      ({money(p.verified_amount ?? 0)} · <span dir="ltr">{p.bank_reference}</span>)
                    </>
                  )}
                  {p.status === "rejected" && <span dir="auto"> — {p.rejection_reason}</span>}
                </p>
                {p.status === "reported" && <PaymentReview paymentId={p.id} reportedAmount={String(p.amount_reported)} a={dict.admin} c={c} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={box}>
        <h3 className="mb-2 font-extrabold">{c.history}</h3>
        <ol className="flex flex-col gap-1 text-sm">
          {events.map((e) => (
            <li key={e.id}>
              <span className="text-muted">{formatDate(e.created_at, lang)}</span> · {(c.events as Record<string, string>)[e.event] ?? e.event}
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
