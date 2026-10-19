import type { ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-5 text-2xl font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
