"use client";

import { use, useState, useTransition } from "react";
import { unsubscribeAction } from "@/app/actions/follow";
import type { Dictionary } from "@/i18n/dictionaries";

export function UnsubscribeForm({
  searchParams,
  text,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  text: Dictionary["follows"];
}) {
  const params = use(searchParams);
  const token = typeof params.t === "string" ? params.t : "";
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
      <h1 className="text-xl font-extrabold">{text.unsubscribeTitle}</h1>
      {state === "done" ? (
        <p role="status" className="font-semibold text-brand">
          {text.unsubscribed}
        </p>
      ) : (
        <>
          <p className="text-muted">{text.unsubscribeIntro}</p>
          {state === "error" && (
            <p role="alert" className="font-semibold text-danger">
              {text.unsubscribeError}
            </p>
          )}
          <button
            type="button"
            disabled={pending || !token}
            onClick={() =>
              startTransition(async () => {
                const result = await unsubscribeAction(token);
                setState(result.ok ? "done" : "error");
              })
            }
            className="h-11 rounded-lg bg-brand px-5 font-bold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {text.unsubscribeButton}
          </button>
        </>
      )}
    </div>
  );
}
