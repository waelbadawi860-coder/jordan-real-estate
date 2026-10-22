import type { ReactNode } from "react";

/**
 * The detailed search: folded until the visitor clicks it (on computers it
 * sits in the right-hand column). Opens by itself only when the current
 * search already uses detailed filters.
 */
export function SideDetails({ summary, open, children }: { summary: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details open={open || undefined} className="rounded-lg border border-border bg-surface p-3 lg:p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-brand">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
