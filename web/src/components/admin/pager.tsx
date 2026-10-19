import Link from "next/link";

/** Previous/next links that keep the current filters. */
export function Pager({
  basePath,
  params,
  page,
  total,
  pageSize,
  text,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize: number;
  text: { prev: string; next: string };
}) {
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-center gap-3 text-sm font-semibold">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-lg border border-border bg-surface px-3 py-2 hover:bg-brand-soft">
          {text.prev}
        </Link>
      )}
      <span dir="ltr">
        {page} / {last}
      </span>
      {page < last && (
        <Link href={href(page + 1)} className="rounded-lg border border-border bg-surface px-3 py-2 hover:bg-brand-soft">
          {text.next}
        </Link>
      )}
    </nav>
  );
}

export function pageFrom(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1;
}

export function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length <= 200 ? v : undefined;
}
