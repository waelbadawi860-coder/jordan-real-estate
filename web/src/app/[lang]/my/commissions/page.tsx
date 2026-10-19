import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getMyCommissions } from "@/lib/data/commission";
import { formatDate, formatPrice } from "@/lib/format";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/commissions">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).commission.title, robots: { index: false } };
}

export default async function MyCommissionsPage({ params }: PageProps<"/[lang]/my/commissions">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireUser(lang, "/my/commissions");
  const [dict, items] = await Promise.all([getDictionary(lang), getMyCommissions(user.id)]);
  const c = dict.commission;

  return (
    <section aria-labelledby="commissions-heading">
      <h1 id="commissions-heading" className="mb-4 text-2xl font-extrabold">
        {c.title}
      </h1>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">{c.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <p className="font-bold" dir="auto">
                  {item.listingTitle}
                </p>
                <p className="text-sm text-muted">
                  {c.reference}: <span dir="ltr">{item.reference}</span> · {c.dueDate}: {formatDate(item.dueDate, lang)}
                </p>
                <p className="text-sm">
                  <span className="rounded-md bg-accent-soft px-2 py-0.5 font-bold">{c.statuses[item.status]}</span>{" "}
                  {c.amountDue}: <span className="font-bold">{formatPrice(item.amountDue, lang, dict.common.currency)}</span>
                </p>
              </div>
              <Link
                href={localePath(lang, `/my/commissions/${item.id}`)}
                className="h-11 w-fit content-center rounded-lg border border-border px-4 font-bold text-brand hover:bg-brand-soft"
              >
                {c.view}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
