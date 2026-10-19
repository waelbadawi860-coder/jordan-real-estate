"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminCommissionAction,
  adminReviewPaymentAction,
  createRuleAction,
  publishAgreementAction,
  retireRuleAction,
  type AdminCommissionResult,
} from "@/app/actions/admin-commission";
import type { Dictionary } from "@/i18n/dictionaries";

type AdminText = Dictionary["admin"];
const btn = "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-brand-soft disabled:opacity-60";
const primary = "rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60";
const danger = "rounded-lg border border-danger/40 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-60";
const field = "h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm";
const labelCls = "flex flex-col gap-1 text-xs font-semibold";

function useRun(a: AdminText, c: Dictionary["commission"]) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  function run(fn: () => Promise<AdminCommissionResult>, onOk?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        setMsg({ ok: true, text: a.listing.done });
        onOk?.();
        router.refresh();
      } else {
        const map: Record<string, string> = {
          not_allowed: a.errors.notAllowed,
          reason_required: a.errors.reasonRequired,
          invalid_status_transition: a.errors.invalidTransition,
          invalid_amount: a.errors.invalid,
          invalid_date: c.errors.invalid_date,
          reference_required: a.errors.invalid,
          legal_review_note_required: a.agreements.reviewNote,
          no_current_agreement: c.errors.no_current_agreement,
          duplicate: a.locations.duplicate,
          invalid: a.errors.invalid,
        };
        setMsg({ ok: false, text: map[r.error] ?? a.errors.generic });
      }
    });
  }
  const message = msg ? (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-brand" : "text-danger"}`}>
      {msg.text}
    </p>
  ) : null;
  return { run, pending, message };
}

export function CommissionControls({ id, status, a, c }: { id: number; status: string; a: AdminText; c: Dictionary["commission"] }) {
  const { run, pending, message } = useRun(a, c);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const k = a.commissions;
  const closed = status === "waived";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      {status === "reported" && (
        <button type="button" className={`${primary} w-fit`} disabled={pending} onClick={() => run(() => adminCommissionAction(id, "confirm", undefined, note))}>
          {k.confirm}
        </button>
      )}
      {!closed && (
        <>
          <label className={labelCls}>
            {k.note}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} dir="auto" className="rounded-lg border border-border p-2 text-sm" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className={labelCls}>
              {k.newAmount}
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className={`${field} w-36`} />
            </label>
            <button type="button" className={btn} disabled={pending} onClick={() => run(() => adminCommissionAction(id, "adjust", amount, note))}>
              {k.adjust}
            </button>
            {status === "disputed" && (
              <button type="button" className={btn} disabled={pending} onClick={() => run(() => adminCommissionAction(id, "resolve_dispute", undefined, note))}>
                {k.resolveDispute}
              </button>
            )}
            {status !== "payment_verified" && (
              <button type="button" className={danger} disabled={pending} onClick={() => run(() => adminCommissionAction(id, "waive", undefined, note))}>
                {k.waive}
              </button>
            )}
          </div>
        </>
      )}
      {message}
    </div>
  );
}

export function PaymentReview({ paymentId, reportedAmount, a, c }: { paymentId: number; reportedAmount: string; a: AdminText; c: Dictionary["commission"] }) {
  const { run, pending, message } = useRun(a, c);
  const k = a.commissions;
  const [verifiedAmount, setVerifiedAmount] = useState(reportedAmount);
  const [verifiedOn, setVerifiedOn] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className={labelCls}>
          {k.verifiedAmount}
          <input value={verifiedAmount} onChange={(e) => setVerifiedAmount(e.target.value)} inputMode="decimal" dir="ltr" className={field} />
        </label>
        <label className={labelCls}>
          {k.verifiedOn}
          <input type="date" value={verifiedOn} onChange={(e) => setVerifiedOn(e.target.value)} className={field} />
        </label>
        <label className={labelCls}>
          {k.bankReference}
          <input value={bankReference} onChange={(e) => setBankReference(e.target.value)} dir="ltr" maxLength={100} className={field} />
        </label>
        <button
          type="button"
          className={primary}
          disabled={pending}
          onClick={() => run(() => adminReviewPaymentAction({ decision: "verify", paymentId, verifiedAmount, verifiedOn, bankReference }))}
        >
          {k.verify}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className={`${labelCls} flex-1`}>
          {k.rejectReason}
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} dir="auto" className={field} />
        </label>
        <button type="button" className={danger} disabled={pending} onClick={() => run(() => adminReviewPaymentAction({ decision: "reject", paymentId, reason }))}>
          {k.reject}
        </button>
      </div>
      {message}
    </div>
  );
}

export function AgreementForm({
  initial,
  a,
  c,
}: {
  initial: { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };
  a: AdminText;
  c: Dictionary["commission"];
}) {
  const { run, pending, message } = useRun(a, c);
  const g = a.agreements;
  const [v, setV] = useState({ versionLabel: "", ...initial, isDraft: true, legalReviewNote: "" });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => publishAgreementAction(v));
      }}
    >
      <label className={labelCls}>
        {g.label}
        <input value={v.versionLabel} onChange={(e) => setV({ ...v, versionLabel: e.target.value })} dir="ltr" required className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          {g.titleAr}
          <input value={v.titleAr} onChange={(e) => setV({ ...v, titleAr: e.target.value })} dir="rtl" className={field} />
        </label>
        <label className={labelCls}>
          {g.titleEn}
          <input value={v.titleEn} onChange={(e) => setV({ ...v, titleEn: e.target.value })} dir="ltr" className={field} />
        </label>
        <label className={labelCls}>
          {g.bodyAr}
          <textarea value={v.bodyAr} onChange={(e) => setV({ ...v, bodyAr: e.target.value })} rows={10} dir="rtl" className="rounded-lg border border-border p-2 text-sm" />
        </label>
        <label className={labelCls}>
          {g.bodyEn}
          <textarea value={v.bodyEn} onChange={(e) => setV({ ...v, bodyEn: e.target.value })} rows={10} dir="ltr" className="rounded-lg border border-border p-2 text-sm" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={v.isDraft} onChange={(e) => setV({ ...v, isDraft: e.target.checked })} className="size-5 accent-brand" />
        {g.isDraft}
      </label>
      {!v.isDraft && (
        <label className={labelCls}>
          {g.reviewNote}
          <input value={v.legalReviewNote} onChange={(e) => setV({ ...v, legalReviewNote: e.target.value })} maxLength={500} dir="auto" required className={field} />
        </label>
      )}
      <p className="text-xs text-muted">{g.publishNote}</p>
      <button type="submit" className={`${primary} w-fit`} disabled={pending}>
        {g.publish}
      </button>
      {message}
    </form>
  );
}

export function RuleForm({ a, c, dealLabels }: { a: AdminText; c: Dictionary["commission"]; dealLabels: { sale: string; rent: string } }) {
  const { run, pending, message } = useRun(a, c);
  const r = a.rules;
  const empty = {
    dealType: "sale" as "sale" | "rent",
    basis: "sale_price" as "sale_price" | "annual_rent" | "monthly_rent" | "fixed_amount",
    percentage: "",
    fixedAmount: "",
    minAmount: "",
    maxAmount: "",
    dueDays: "7",
    triggerEvent: "transaction_completed" as "transaction_completed" | "contract_signed",
  };
  const [v, setV] = useState(empty);
  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createRuleAction(v), () => setV(empty));
      }}
    >
      <label className={labelCls}>
        {r.dealType}
        <select value={v.dealType} onChange={(e) => setV({ ...v, dealType: e.target.value as typeof v.dealType })} className={field}>
          <option value="sale">{dealLabels.sale}</option>
          <option value="rent">{dealLabels.rent}</option>
        </select>
      </label>
      <label className={labelCls}>
        {r.basis}
        <select value={v.basis} onChange={(e) => setV({ ...v, basis: e.target.value as typeof v.basis })} className={field}>
          {(["sale_price", "annual_rent", "monthly_rent", "fixed_amount"] as const).map((b) => (
            <option key={b} value={b}>
              {r.bases[b]}
            </option>
          ))}
        </select>
      </label>
      {v.basis === "fixed_amount" ? (
        <label className={labelCls}>
          {r.fixedAmount}
          <input value={v.fixedAmount} onChange={(e) => setV({ ...v, fixedAmount: e.target.value })} inputMode="decimal" dir="ltr" className={field} />
        </label>
      ) : (
        <label className={labelCls}>
          {r.percentage}
          <input value={v.percentage} onChange={(e) => setV({ ...v, percentage: e.target.value })} inputMode="decimal" dir="ltr" className={field} />
        </label>
      )}
      <label className={labelCls}>
        {r.dueDays}
        <input value={v.dueDays} onChange={(e) => setV({ ...v, dueDays: e.target.value })} inputMode="numeric" dir="ltr" className={field} />
      </label>
      <label className={labelCls}>
        {r.min}
        <input value={v.minAmount} onChange={(e) => setV({ ...v, minAmount: e.target.value })} inputMode="decimal" dir="ltr" className={field} />
      </label>
      <label className={labelCls}>
        {r.max}
        <input value={v.maxAmount} onChange={(e) => setV({ ...v, maxAmount: e.target.value })} inputMode="decimal" dir="ltr" className={field} />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        {r.trigger}
        <select value={v.triggerEvent} onChange={(e) => setV({ ...v, triggerEvent: e.target.value as typeof v.triggerEvent })} className={field}>
          <option value="transaction_completed">{c.triggers.transaction_completed}</option>
          <option value="contract_signed">{c.triggers.contract_signed}</option>
        </select>
      </label>
      <p className="text-xs text-muted sm:col-span-4">{r.createNote}</p>
      <button type="submit" className={`${primary} w-fit`} disabled={pending}>
        {r.create}
      </button>
      <div className="sm:col-span-4">{message}</div>
    </form>
  );
}

export function RetireRuleButton({ ruleId, a, c }: { ruleId: number; a: AdminText; c: Dictionary["commission"] }) {
  const { run, pending, message } = useRun(a, c);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={danger} disabled={pending} onClick={() => run(() => retireRuleAction(ruleId))}>
        {a.rules.retire}
      </button>
      {message}
    </span>
  );
}
