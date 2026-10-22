"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  addBlockedAction,
  completeDeletionAction,
  moderateListingAction,
  promoteListingAction,
  reviewOfficeAction,
  savePlanAction,
  setOfficePlanAction,
  setOfficeStatusAction,
  recheckRiskAction,
  removeBlockedAction,
  resolveReportAction,
  saveCityAction,
  saveNeighborhoodAction,
  savePropertyTypeAction,
  saveSettingAction,
  setListingExpiryAction,
  setUserStatusAction,
  type AdminResult,
} from "@/app/actions/admin";
import type { Dictionary } from "@/i18n/dictionaries";

type AdminText = Dictionary["admin"];

const btn = "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-brand-soft disabled:opacity-60";
const primary = "rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60";
const danger = "rounded-lg border border-danger/40 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-60";
const field = "h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm";

function useRun(a: AdminText) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  function run(action: () => Promise<AdminResult>, onOk?: () => void) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setFeedback({ ok: true, text: a.listing.done });
        onOk?.();
        router.refresh();
      } else {
        const map: Record<string, string> = {
          notAllowed: a.errors.notAllowed,
          reasonRequired: a.errors.reasonRequired,
          invalid: a.errors.invalid,
          invalidTransition: a.errors.invalidTransition,
          ownAccount: a.errors.ownAccount,
          duplicate: a.locations.duplicate,
          draftAgreement: a.settings.draftAgreement,
          needSecondStep: a.settings.needSecondStep,
        };
        setFeedback({ ok: false, text: map[result.error] ?? a.errors.generic });
      }
    });
  }
  const message = feedback ? (
    <p role={feedback.ok ? "status" : "alert"} className={`text-sm font-semibold ${feedback.ok ? "text-brand" : "text-danger"}`}>
      {feedback.text}
    </p>
  ) : null;
  return { run, pending, message };
}

function Box({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">{children}</div>;
}

// ----------------------------------------------------------------------------

export function ListingModeration({ listingId, status, a }: { listingId: number; status: string; a: AdminText }) {
  const { run, pending, message } = useRun(a);
  const [reason, setReason] = useState("");
  const canApprove = status === "pending_approval" || status === "expired";
  const canReject = status === "pending_approval";
  const canTakeDown = status === "published" || status === "on_hold";
  const canHold = status === "published";
  const canRelease = status === "on_hold";
  const canExpire = status === "published" || status === "expired";
  // New submissions: the reviewer ticks every check before approving; the
  // unticked ones can fill in the rejection reason.
  const review = a.review;
  const [checked, setChecked] = useState<boolean[]>(() => review.items.map(() => false));
  const needsChecklist = status === "pending_approval";
  const allChecked = checked.every(Boolean);
  const failedReasons = review.items.filter((_, i) => !checked[i]).map((item) => item.reason);

  return (
    <Box>
      {needsChecklist && (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 font-extrabold">{review.title}</legend>
          {review.items.map((item, i) => (
            <label key={item.check} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-brand"
                checked={checked[i]}
                onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              {item.check}
            </label>
          ))}
          {!allChecked && <p className="text-xs text-muted">{review.hint}</p>}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <button
            type="button"
            className={primary}
            disabled={pending || (needsChecklist && !allChecked)}
            onClick={() => run(() => moderateListingAction(listingId, "approve"))}
          >
            {a.listing.approve}
          </button>
        )}
        {canRelease && (
          <button type="button" className={primary} disabled={pending} onClick={() => run(() => moderateListingAction(listingId, "release"))}>
            {a.listing.release}
          </button>
        )}
        {canExpire && (
          <>
            <button type="button" className={btn} disabled={pending} onClick={() => run(() => setListingExpiryAction(listingId, "extend30"))}>
              {a.listing.extend30}
            </button>
            {status === "published" && (
              <button type="button" className={btn} disabled={pending} onClick={() => run(() => setListingExpiryAction(listingId, "now"))}>
                {a.listing.expireNow}
              </button>
            )}
          </>
        )}
        {status !== "archived" && (
          <button type="button" className={danger} disabled={pending} onClick={() => run(() => moderateListingAction(listingId, "archive"))}>
            {a.listing.archive}
          </button>
        )}
      </div>
      {(canReject || canTakeDown) && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-semibold" htmlFor="reject-reason">
              {a.listing.rejectReason}
            </label>
            {needsChecklist && failedReasons.length > 0 && (
              <button type="button" className="text-sm font-bold text-brand hover:underline" onClick={() => setReason(failedReasons.join("\n"))}>
                {review.fillReason}
              </button>
            )}
          </div>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            rows={2}
            dir="auto"
            className="rounded-lg border border-border p-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {canHold && (
              <button
                type="button"
                className={btn}
                disabled={pending}
                onClick={() => run(() => moderateListingAction(listingId, "hold", reason), () => setReason(""))}
              >
                {a.listing.hold}
              </button>
            )}
            <button
              type="button"
              className={`${danger} w-fit`}
              disabled={pending}
              onClick={() => run(() => moderateListingAction(listingId, canReject ? "reject" : "take_down", reason), () => setReason(""))}
            >
              {canReject ? a.listing.reject : a.listing.takeDown}
            </button>
          </div>
        </div>
      )}
      {message}
    </Box>
  );
}

// ----------------------------------------------------------------------------

/** Featured / move to top, recorded after the seller has paid. */
export function PromotionControls({ listingId, published, a }: { listingId: number; published: boolean; a: AdminText }) {
  const { run, pending, message } = useRun(a);
  const p = a.promotion;
  const [amount, setAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [note, setNote] = useState("");
  const paid = () => ({
    amount: amount.trim() === "" ? undefined : Number(amount),
    paymentRef: paymentRef || undefined,
    note: note || undefined,
  });
  const clear = () => {
    setAmount("");
    setPaymentRef("");
    setNote("");
  };
  const promote = (kind: "feature" | "bump" | "unfeature", days?: number) =>
    run(() => promoteListingAction({ listingId, kind, days, ...(kind === "unfeature" ? {} : paid()) }), clear);

  return (
    <Box>
      <h3 className="font-extrabold">{p.title}</h3>
      {!published ? (
        <p className="text-sm text-muted">{p.onlyPublished}</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-sm font-semibold">
              {p.amount}
              <input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="text-sm font-semibold">
              {p.paymentRef}
              <input className={field} maxLength={100} value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} dir="auto" />
            </label>
            <label className="text-sm font-semibold">
              {p.note}
              <input className={field} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {[7, 14, 30].map((days) => (
              <button key={days} type="button" className={primary} disabled={pending} onClick={() => promote("feature", days)}>
                {p.feature.replace("{n}", String(days))}
              </button>
            ))}
            <button type="button" className={btn} disabled={pending} onClick={() => promote("bump")}>
              {p.bump}
            </button>
          </div>
        </>
      )}
      <button type="button" className={`${danger} w-fit`} disabled={pending} onClick={() => promote("unfeature")}>
        {p.unfeature}
      </button>
      <p className="text-xs text-muted">{p.hint}</p>
      {message}
    </Box>
  );
}

// ----------------------------------------------------------------------------

export function UserStatusControls({ userId, status, isSelf, a }: { userId: string; status: string; isSelf: boolean; a: AdminText }) {
  const { run, pending, message } = useRun(a);
  const [reason, setReason] = useState("");
  const [takeDown, setTakeDown] = useState(true);
  if (isSelf) return <p className="text-sm text-muted">{a.users.ownAccount}</p>;
  if (status === "deleted") return null;

  return (
    <Box>
      <label className="text-sm font-semibold" htmlFor="status-reason">
        {a.users.reason}
      </label>
      <textarea
        id="status-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={2}
        dir="auto"
        className="rounded-lg border border-border p-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        {status === "active" && (
          <>
            <button type="button" className={danger} disabled={pending} onClick={() => run(() => setUserStatusAction(userId, "suspended", reason, takeDown))}>
              {a.users.suspend}
            </button>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={takeDown} onChange={(e) => setTakeDown(e.target.checked)} className="size-4 accent-brand" />
              {a.listing.takeDown}
            </label>
          </>
        )}
        {status === "suspended" && (
          <button type="button" className={primary} disabled={pending} onClick={() => run(() => setUserStatusAction(userId, "active", reason))}>
            {a.users.reactivate}
          </button>
        )}
      </div>
      {(status === "deletion_requested" || status === "suspended") && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <p className="text-xs text-muted">{a.users.completeDeletionHint}</p>
          <button
            type="button"
            className={`${danger} w-fit`}
            disabled={pending}
            onClick={() => window.confirm(a.users.confirmDeletion) && run(() => completeDeletionAction(userId, reason))}
          >
            {a.users.completeDeletion}
          </button>
        </div>
      )}
      {message}
    </Box>
  );
}

// ----------------------------------------------------------------------------

export function ReportControls({ kind, id, status, a }: { kind: "listing" | "user" | "message"; id: number; status: string; a: AdminText }) {
  const { run, pending, message } = useRun(a);
  const [note, setNote] = useState("");
  const closed = status === "resolved" || status === "dismissed";
  return (
    <div className="flex flex-col gap-2">
      {!closed && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder={a.reports.note}
          aria-label={a.reports.note}
          dir="auto"
          className={field}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {status === "open" && (
          <button type="button" className={btn} disabled={pending} onClick={() => run(() => resolveReportAction(kind, id, "reviewing", note))}>
            {a.reports.markReviewing}
          </button>
        )}
        {!closed && (
          <>
            <button type="button" className={primary} disabled={pending} onClick={() => run(() => resolveReportAction(kind, id, "resolved", note))}>
              {a.reports.resolve}
            </button>
            <button type="button" className={btn} disabled={pending} onClick={() => run(() => resolveReportAction(kind, id, "dismissed", note))}>
              {a.reports.dismiss}
            </button>
          </>
        )}
      </div>
      {message}
    </div>
  );
}

// ----------------------------------------------------------------------------

export function SettingField({
  settingKey,
  label,
  value,
  kind,
  a,
}: {
  settingKey: string;
  label: string;
  value: string;
  kind: "text" | "number" | "boolean";
  a: AdminText;
}) {
  const { run, pending, message } = useRun(a);
  const [current, setCurrent] = useState(value);
  const id = `setting-${settingKey}`;
  return (
    <form
      className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveSettingAction(settingKey, current));
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold sm:w-1/2">
        {label}
      </label>
      <div className="flex flex-1 items-center gap-2">
        {kind === "boolean" ? (
          <select id={id} value={current} onChange={(e) => setCurrent(e.target.value)} className={field}>
            <option value="true">✓</option>
            <option value="false">✗</option>
          </select>
        ) : (
          <input
            id={id}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            inputMode={kind === "number" ? "numeric" : undefined}
            dir={kind === "number" ? "ltr" : "auto"}
            className={field}
          />
        )}
        <button type="submit" className={primary} disabled={pending || current === value}>
          {a.settings.save}
        </button>
      </div>
      {message}
    </form>
  );
}

// ----------------------------------------------------------------------------

type NamedRow = {
  id?: number;
  nameAr: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  hasBedrooms?: boolean;
  hasBathrooms?: boolean;
  hasFloor?: boolean;
  hasFurnished?: boolean;
  hasFloorsCount?: boolean;
  allowedDeals?: ("sale" | "rent")[];
};

function slugFrom(nameEn: string) {
  return nameEn
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Add/edit form for a city, neighborhood or property type. */
export function NamedRowForm({
  kind,
  row,
  cityId,
  a,
}: {
  kind: "city" | "neighborhood" | "type";
  row?: NamedRow;
  cityId?: number;
  a: AdminText;
}) {
  const { run, pending, message } = useRun(a);
  const empty: NamedRow = {
    nameAr: "",
    nameEn: "",
    slug: "",
    sortOrder: 100,
    isActive: true,
    hasBedrooms: false,
    hasBathrooms: true,
    hasFloor: false,
    hasFurnished: false,
    hasFloorsCount: false,
    allowedDeals: ["sale", "rent"],
  };
  const [v, setV] = useState<NamedRow>(row ?? empty);
  const [slugTouched, setSlugTouched] = useState(Boolean(row));
  const l = a.locations;

  const deals = v.allowedDeals ?? ["sale", "rent"];
  function toggleDeal(deal: "sale" | "rent", on: boolean) {
    setV({ ...v, allowedDeals: on ? [...new Set([...deals, deal])] : deals.filter((d) => d !== deal) });
  }

  function save() {
    const input = { ...v, slug: v.slug || slugFrom(v.nameEn) };
    run(
      () =>
        kind === "city"
          ? saveCityAction(input)
          : kind === "neighborhood"
            ? saveNeighborhoodAction({ ...input, cityId })
            : savePropertyTypeAction({ ...input, hasBedrooms: Boolean(v.hasBedrooms), hasBathrooms: Boolean(v.hasBathrooms), hasFloor: Boolean(v.hasFloor), hasFurnished: Boolean(v.hasFurnished), hasFloorsCount: Boolean(v.hasFloorsCount), allowedDeals: deals }),
      () => {
        if (!row) {
          setV(empty);
          setSlugTouched(false);
        }
      },
    );
  }

  const prefix = `${kind}-${row?.id ?? "new"}`;
  return (
    <form
      className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_80px_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex flex-col gap-0.5 text-xs font-semibold">
        {l.nameAr}
        <input dir="rtl" value={v.nameAr} required onChange={(e) => setV({ ...v, nameAr: e.target.value })} className={field} id={`${prefix}-ar`} />
      </label>
      <label className="flex flex-col gap-0.5 text-xs font-semibold">
        {l.nameEn}
        <input
          dir="ltr"
          value={v.nameEn}
          required
          onChange={(e) => setV({ ...v, nameEn: e.target.value, slug: slugTouched ? v.slug : slugFrom(e.target.value) })}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs font-semibold" title={l.slugHint}>
        {l.slug}
        <input
          dir="ltr"
          value={v.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setV({ ...v, slug: e.target.value });
          }}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs font-semibold">
        {l.order}
        <input dir="ltr" inputMode="numeric" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) || 0 })} className={field} />
      </label>
      <div className="flex flex-col gap-1 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-4 accent-brand" />
          {l.active}
        </label>
        {kind === "type" && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={Boolean(v.hasBedrooms)} onChange={(e) => setV({ ...v, hasBedrooms: e.target.checked })} className="size-4 accent-brand" />
            {a.types.hasBedrooms}
          </label>
        )}
        {kind === "type" && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={Boolean(v.hasBathrooms)} onChange={(e) => setV({ ...v, hasBathrooms: e.target.checked })} className="size-4 accent-brand" />
            {a.types.hasBathrooms}
          </label>
        )}
        {kind === "type" && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={Boolean(v.hasFurnished)} onChange={(e) => setV({ ...v, hasFurnished: e.target.checked })} className="size-4 accent-brand" />
            {a.types.hasFurnished}
          </label>
        )}
        {kind === "type" && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={Boolean(v.hasFloorsCount)} onChange={(e) => setV({ ...v, hasFloorsCount: e.target.checked })} className="size-4 accent-brand" />
            {a.types.hasFloorsCount}
          </label>
        )}
        {kind === "type" && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={Boolean(v.hasFloor)} onChange={(e) => setV({ ...v, hasFloor: e.target.checked })} className="size-4 accent-brand" />
            {a.types.hasFloor}
          </label>
        )}
        {kind === "type" && (
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">{a.types.allowedDeals}</legend>
            <span aria-hidden>{a.types.allowedDeals}:</span>
            {(["sale", "rent"] as const).map((deal) => (
              <label key={deal} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={deals.includes(deal)}
                  onChange={(e) => toggleDeal(deal, e.target.checked)}
                  className="size-4 accent-brand"
                />
                {a.types[deal]}
              </label>
            ))}
            {deals.length === 0 && <span className="text-danger">{a.types.dealRequired}</span>}
          </fieldset>
        )}
      </div>
      <button type="submit" className={primary} disabled={pending || (kind === "type" && deals.length === 0)}>
        {row ? l.save : l.add}
      </button>
      <div className="col-span-full">{message}</div>
    </form>
  );
}

// ----------------------------------------------------------------------------

export function RecheckRiskButton({ listingId, a }: { listingId: number; a: AdminText }) {
  const { run, pending, message } = useRun(a);
  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={`${btn} w-fit`} disabled={pending} onClick={() => run(() => recheckRiskAction(listingId))}>
        {a.risk.recheck}
      </button>
      {message}
    </div>
  );
}

export function BlockListForm({ a }: { a: AdminText }) {
  const { run, pending, message } = useRun(a);
  const b = a.blocklist;
  const [kind, setKind] = useState<"phone" | "email">("phone");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="grid items-end gap-2 sm:grid-cols-[auto_1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addBlockedAction({ kind, value, reason }),
          () => {
            setValue("");
            setReason("");
          },
        );
      }}
    >
      <label className="flex flex-col gap-0.5 text-xs font-semibold">
        {b.kind}
        <select id="block-kind" value={kind} onChange={(e) => setKind(e.target.value as "phone" | "email")} className={field}>
          <option value="phone">{b.phone}</option>
          <option value="email">{b.email}</option>
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-xs font-semibold">
        {b.value}
        <input id="block-value" dir="ltr" required value={value} onChange={(e) => setValue(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-0.5 text-xs font-semibold">
        {b.reason}
        <input id="block-reason" dir="auto" required minLength={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
      </label>
      <button type="submit" className={primary} disabled={pending}>
        {b.add}
      </button>
      <div className="col-span-full">{message}</div>
    </form>
  );
}

export function RemoveBlockedButton({ id, a }: { id: number; a: AdminText }) {
  const { run, pending, message } = useRun(a);
  return (
    <span className="flex items-center gap-2">
      <button type="button" className={danger} disabled={pending} onClick={() => run(() => removeBlockedAction(id))}>
        {a.blocklist.remove}
      </button>
      {message}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Offices
// ----------------------------------------------------------------------------

export function OfficeReviewControls({ requestId, a }: { requestId: number; a: AdminText }) {
  const { run, pending, message } = useRun(a);
  const [reason, setReason] = useState("");
  const o = a.offices;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold">
        {o.reason}
        <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} dir="auto" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={pending} onClick={() => run(() => reviewOfficeAction(requestId, true, reason))}>
          {o.approve}
        </button>
        <button type="button" className={danger} disabled={pending} onClick={() => run(() => reviewOfficeAction(requestId, false, reason))}>
          {o.reject}
        </button>
      </div>
      {message}
    </div>
  );
}

export function OfficeAdminControls({
  officeId,
  plans,
  verified,
  suspended,
  locale,
  a,
}: {
  officeId: number;
  plans: { slug: string; name: { ar: string; en: string } }[];
  verified: boolean;
  suspended: boolean;
  locale: "ar" | "en";
  a: AdminText;
}) {
  const { run, pending, message } = useRun(a);
  const o = a.offices;
  const [plan, setPlan] = useState(plans[0]?.slug ?? "");
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-sm font-semibold">
          {o.plan}
          <select className={field} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {plans.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name[locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          {o.months}
          <select className={field} value={months} onChange={(e) => setMonths(e.target.value)}>
            {[1, 3, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          {o.amount}
          <input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          {o.paymentRef}
          <input className={field} maxLength={100} value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} dir="auto" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primary}
          disabled={pending || !plan}
          onClick={() =>
            run(() =>
              setOfficePlanAction({
                officeId,
                planSlug: plan,
                months: Number(months),
                amount: amount.trim() === "" ? undefined : Number(amount),
                paymentRef: paymentRef || undefined,
              }),
            )
          }
        >
          {o.setPlan}
        </button>
        <button type="button" className={btn} disabled={pending} onClick={() => run(() => setOfficePlanAction({ officeId, planSlug: null }))}>
          {o.clearPlan}
        </button>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <label className="text-sm font-semibold">
          {o.statusReason}
          <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} dir="auto" />
        </label>
        <div className="flex flex-wrap gap-2">
          {verified && (
            <button type="button" className={danger} disabled={pending} onClick={() => run(() => setOfficeStatusAction(officeId, true, suspended, reason))}>
              {o.removeBadge}
            </button>
          )}
          <button type="button" className={suspended ? btn : danger} disabled={pending} onClick={() => run(() => setOfficeStatusAction(officeId, false, !suspended, reason))}>
            {suspended ? o.activate : o.suspend}
          </button>
        </div>
      </div>
      {message}
    </div>
  );
}

export function PlanEditor({
  plan,
  locale,
  a,
}: {
  plan: { slug: string; name: { ar: string; en: string }; priceJod: number; maxActiveListings: number; featuredPerMonth: number; includesVerification: boolean; isActive: boolean };
  locale: "ar" | "en";
  a: AdminText;
}) {
  const { run, pending, message } = useRun(a);
  const o = a.offices;
  const [price, setPrice] = useState(String(plan.priceJod));
  const [max, setMax] = useState(String(plan.maxActiveListings));
  const [featured, setFeatured] = useState(String(plan.featuredPerMonth));
  const [verification, setVerification] = useState(plan.includesVerification);
  const [active, setActive] = useState(plan.isActive);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="font-extrabold">{plan.name[locale]}</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs font-semibold">
          {o.price}
          <input className={field} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="text-xs font-semibold">
          {o.maxListings}
          <input className={field} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label className="text-xs font-semibold">
          {o.featured}
          <input className={field} inputMode="numeric" value={featured} onChange={(e) => setFeatured(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand" checked={verification} onChange={(e) => setVerification(e.target.checked)} />
        {o.includesVerification}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {o.active}
      </label>
      <button
        type="button"
        className={`${primary} w-fit`}
        disabled={pending}
        onClick={() =>
          run(() =>
            savePlanAction({
              slug: plan.slug,
              priceJod: Number(price),
              maxActiveListings: Number(max),
              featuredPerMonth: Number(featured),
              includesVerification: verification,
              isActive: active,
            }),
          )
        }
      >
        {o.savePlan}
      </button>
      {message}
    </div>
  );
}

