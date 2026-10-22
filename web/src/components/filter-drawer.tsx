"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRef, type ReactNode } from "react";

/**
 * "Filters" button beside the search box. Opens the detailed search in a
 * panel that slides over the page (from the right on computers, full screen
 * on phones), so nothing underneath moves. A native <dialog>: Esc, the ✕
 * button or a click outside close it, and keyboard focus stays inside.
 */
export function FilterDrawer({
  label,
  closeLabel,
  activeCount,
  children,
}: {
  label: string;
  closeLabel: string;
  activeCount: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={`flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 font-bold ${
          activeCount > 0 ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-foreground hover:border-brand"
        }`}
      >
        <SlidersHorizontal className="size-5" aria-hidden />
        <span>{activeCount > 0 ? `${label} (${activeCount})` : label}</span>
      </button>
      <dialog
        ref={ref}
        aria-label={label}
        onClick={(e) => {
          if (e.target === ref.current) ref.current.close();
        }}
        className="fixed inset-y-0 m-0 me-auto h-dvh max-h-none w-full max-w-none bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40 sm:max-w-md"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="flex items-center gap-2 text-lg font-extrabold">
              <SlidersHorizontal className="size-5 text-brand" aria-hidden />
              {label}
            </p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label={closeLabel}
              className="rounded-lg p-2 text-muted hover:bg-brand-soft hover:text-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}
