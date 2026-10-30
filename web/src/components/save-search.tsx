"use client";

import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveSearchAction } from "@/app/actions/follow";
import type { SearchFilters } from "@/lib/search";

type Text = { save: string; saved: string; hint: string; limit: string; tooBroad: string; error: string; manage: string };

/**
 * "Save this search": new matching ads arrive as a notification and in the
 * daily e-mail. Visitors who aren't signed in are sent to log in and come back.
 */
export function SaveSearch({
  filters,
  loginHref,
  manageHref,
  text,
}: {
  filters: SearchFilters;
  loginHref: string;
  manageHref: string;
  text: Text;
}) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const button = "flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold";

  if (saved) {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`${button} border-brand bg-brand-soft text-brand`}>
          <BellRing className="size-4" aria-hidden />
          {text.saved}
        </span>
        <Link href={manageHref} className="font-semibold text-brand hover:underline">
          {text.manage}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveSearchAction(filters);
            if (result.ok) {
              setSaved(true);
              setMessage(null);
            } else if (result.error === "signIn") {
              window.location.assign(loginHref);
            } else {
              setMessage(result.error === "limit" ? text.limit : result.error === "tooBroad" ? text.tooBroad : text.error);
            }
          })
        }
        className={`${button} w-fit border-brand text-brand hover:bg-brand-soft disabled:opacity-60`}
      >
        <Bell className="size-4" aria-hidden />
        {text.save}
      </button>
      <p className="text-xs text-muted">{message ?? text.hint}</p>
    </div>
  );
}
