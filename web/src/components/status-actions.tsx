"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeStatusAction, deleteDraftAction, renewListingAction, type ActionResult } from "@/app/actions/listings";
import type { Locale } from "@/i18n/config";
import { localePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ListingStatus } from "@/lib/data/owner";

type Confirm =
  | { kind: "sold" | "rented" | "archived" | "delete"; message: string }
  | { kind: "withdrawn"; message: string };

const errorKeyToText = (dict: Pick<Dictionary, "preview" | "form">, key: string) =>
  ({
    contact_required: dict.preview.needContact,
    images_required: dict.preview.needPhotos,
    account_not_active: dict.form.errors.accountInactive,
    invalid_status_transition: dict.form.errors.notEditable,
    notEditable: dict.form.errors.notEditable,
  })[key] ?? dict.form.errors.generic;

/** The buttons a seller sees for one listing, depending on its status. */
export function StatusActions({
  locale,
  listingId,
  status,
  dealType,
  canRenew,
  publicHref,
  showPreview = true,
  showSubmit = false,
  requireApproval,
  dict,
}: {
  locale: Locale;
  listingId: number;
  status: ListingStatus;
  dealType: "sale" | "rent";
  canRenew: boolean;
  publicHref: string;
  showPreview?: boolean;
  showSubmit?: boolean;
  requireApproval: boolean;
  dict: Pick<Dictionary, "myListings" | "preview" | "form">;
}) {
  const m = dict.myListings;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [reason, setReason] = useState<"unavailable" | "changed_mind" | "other">("unavailable");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setConfirm(null);
      if (result.ok) {
        const text =
          result.message === "submitted"
            ? dict.preview.submitted
            : result.message === "published"
              ? dict.preview.published
              : result.message === "renewed"
                ? m.renewed
                : m.updated;
        setFeedback({ kind: "ok", text });
        router.refresh();
      } else {
        setFeedback({ kind: "error", text: errorKeyToText(dict, result.error) });
      }
    });
  }

  const editable = ["draft", "pending_approval", "rejected", "published", "expired"].includes(status);
  const btn = "rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-brand-soft disabled:opacity-60";
  const primary = "rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-strong disabled:opacity-60";
  const danger = "rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-60";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {showSubmit && (status === "draft" || status === "rejected" || status === "withdrawn") && (
          <button type="button" disabled={pending} className={primary} onClick={() => run(() => changeStatusAction(listingId, "pending_approval"))}>
            {status === "draft" ? (requireApproval ? dict.preview.submit : dict.preview.submitDirect) : m.resubmit}
          </button>
        )}
        {status === "published" && (
          <Link href={publicHref} className={btn}>
            {m.view}
          </Link>
        )}
        {editable && (
          <Link href={localePath(locale, `/my/listings/${listingId}/edit`)} className={btn}>
            {m.edit}
          </Link>
        )}
        {showPreview && status !== "published" && status !== "archived" && (
          <Link href={localePath(locale, `/my/listings/${listingId}`)} className={btn}>
            {m.preview}
          </Link>
        )}
        {canRenew && (status === "published" || status === "expired") && (
          <button type="button" disabled={pending} className={primary} onClick={() => run(() => renewListingAction(listingId))}>
            {m.renew}
          </button>
        )}
        {(status === "published" || status === "expired") && (
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() =>
              setConfirm(
                dealType === "sale" ? { kind: "sold", message: m.confirmSold } : { kind: "rented", message: m.confirmRented },
              )
            }
          >
            {dealType === "sale" ? m.markSold : m.markRented}
          </button>
        )}
        {status === "pending_approval" && (
          <button type="button" disabled={pending} className={btn} onClick={() => run(() => changeStatusAction(listingId, "draft"))}>
            {m.backToDraft}
          </button>
        )}
        {["published", "expired", "pending_approval"].includes(status) && (
          <button type="button" disabled={pending} className={danger} onClick={() => setConfirm({ kind: "withdrawn", message: m.confirmWithdraw })}>
            {m.withdraw}
          </button>
        )}
        {["rejected", "withdrawn", "expired", "sold", "rented"].includes(status) && (
          <button type="button" disabled={pending} className={danger} onClick={() => setConfirm({ kind: "archived", message: m.confirmArchive })}>
            {m.archive}
          </button>
        )}
        {status === "draft" && (
          <button type="button" disabled={pending} className={danger} onClick={() => setConfirm({ kind: "delete", message: m.confirmDelete })}>
            {m.deleteDraft}
          </button>
        )}
      </div>

      {confirm && (
        <div role="alertdialog" aria-label={confirm.message} className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3">
          <p className="font-semibold">{confirm.message}</p>
          {confirm.kind === "withdrawn" && (
            <label className="flex flex-col gap-1 text-sm">
              {m.withdrawReason}
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
                className="h-10 rounded-lg border border-border bg-surface px-2"
              >
                <option value="unavailable">{m.reasonUnavailable}</option>
                <option value="changed_mind">{m.reasonChangedMind}</option>
                <option value="other">{m.reasonOther}</option>
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              className={primary}
              onClick={() =>
                run(() =>
                  confirm.kind === "delete"
                    ? deleteDraftAction(listingId, locale)
                    : changeStatusAction(listingId, confirm.kind, confirm.kind === "withdrawn" ? reason : undefined),
                )
              }
            >
              {m.confirm}
            </button>
            <button type="button" className={btn} onClick={() => setConfirm(null)}>
              {m.cancel}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <p role={feedback.kind === "error" ? "alert" : "status"} className={`text-sm font-semibold ${feedback.kind === "error" ? "text-danger" : "text-brand"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
