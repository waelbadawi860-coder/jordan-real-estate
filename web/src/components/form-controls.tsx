"use client";

import { Loader2 } from "lucide-react";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export const inputClass =
  "h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground focus:border-brand focus:outline-none aria-[invalid=true]:border-danger";

/** Labelled input with hint and error text wired up for screen readers. */
export function TextField({
  id,
  label,
  hint,
  error,
  ...props
}: { id: string; label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClass} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingText, pending }: { children: ReactNode; pendingText: string; pending?: boolean }) {
  const status = useFormStatus();
  const isPending = pending ?? status.pending;
  return (
    <button
      type="submit"
      disabled={isPending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 text-lg font-bold text-white hover:bg-brand-strong disabled:opacity-60"
    >
      {isPending && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {isPending ? pendingText : children}
    </button>
  );
}

/**
 * React clears a form after a Server Action runs when it's passed as the
 * form's `action`. Submitting through this handler instead keeps what the
 * person typed, so a validation error never wipes a long form.
 */
export function keepValuesOnSubmit(run: (formData: FormData) => void, startTransition: (fn: () => void) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => run(formData));
  };
}

export function FormMessage({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-danger/30 bg-danger/5 text-danger",
    success: "border-brand/30 bg-brand-soft text-brand-strong",
    info: "border-accent/30 bg-accent-soft text-foreground",
  }[kind];
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm font-semibold ${styles}`}>
      {children}
    </p>
  );
}
