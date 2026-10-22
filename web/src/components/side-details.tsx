"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Folded section on phones; on a computer (1024px and wider) it opens by
 * itself and its title line is hidden, so it works as a side column.
 */
export function SideDetails({ summary, open, children }: { summary: ReactNode; open?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      if (wide.matches && ref.current) ref.current.open = true;
    };
    apply();
    wide.addEventListener("change", apply);
    return () => wide.removeEventListener("change", apply);
  }, []);
  return (
    <details ref={ref} open={open || undefined} className="rounded-lg border border-border bg-surface p-3 lg:p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-brand lg:pointer-events-none lg:mb-3 lg:list-none lg:text-foreground lg:[&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      {children}
    </details>
  );
}
