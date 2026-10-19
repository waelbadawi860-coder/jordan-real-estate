import { ImageOff, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusActions } from "@/components/status-actions";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getMyListings } from "@/lib/data/owner";
import { getReferenceData } from "@/lib/data/public";
import { formatDate, formatPrice, t } from "@/lib/format";
import { canRenewListing } from "@/lib/listing-rules";
import { listingPath } from "@/lib/paths";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/listings">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).myListings.title, robots: { index: false } };
}

const statusStyle: Record<string, string> = {
  draft: "bg-border text-foreground",
  pending_approval: "bg-accent-soft text-accent",
  published: "bg-brand-soft text-brand-strong",
  rejected: "bg-danger/10 text-danger",
  expired: "bg-border text-muted",
  sold: "bg-brand text-white",
  rented: "bg-brand text-white",
  withdrawn: "bg-border text-muted",
  archived: "bg-border text-muted",
};

export default async function MyListingsPage({ params }: PageProps<"/[lang]/my/listings">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireUser(lang, "/my/listings");
  const [dict, listings, ref] = await Promise.all([getDictionary(lang), getMyListings(user.id), getReferenceData()]);
  const m = dict.myListings;
  const windowDays = Number(ref.settings.renewal_window_days ?? 7);
  const requireApproval = ref.settings.require_listing_approval !== false;

  return (
    <section aria-labelledby="my-listings-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 id="my-listings-heading" className="text-2xl font-extrabold">
          {m.title}
        </h1>
        <Link href={localePath(lang, "/post")} className="flex h-11 items-center gap-1 rounded-lg bg-accent px-4 font-bold text-white hover:opacity-90">
          <Plus className="size-5" aria-hidden />
          {m.add}
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">{m.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((l) => {
            const canRenew = canRenewListing(l.status, l.expiresAt, windowDays);
            return (
              <li key={l.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row">
                <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-brand-soft sm:w-40">
                  {l.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted">
                      <ImageOff className="size-6" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${statusStyle[l.status]}`}>{dict.status[l.status]}</span>
                    <span className="text-xs text-muted" dir="ltr">
                      #{l.id}
                    </span>
                    <span className="text-xs text-muted">{t(m.photosCount, { n: l.photoCount })}</span>
                  </div>
                  <h2 className="truncate font-bold" dir="auto">
                    {l.title}
                  </h2>
                  <p className="font-extrabold text-brand-strong">{formatPrice(l.price, lang, dict.common.currency)}</p>
                  {l.status === "rejected" && l.rejectionReason && (
                    <p className="text-sm font-semibold text-danger">{t(m.rejectionReason, { reason: l.rejectionReason })}</p>
                  )}
                  {l.expiresAt && (l.status === "published" || l.status === "expired") && (
                    <p className="text-sm text-muted">
                      {t(l.status === "expired" ? m.expiredOn : m.expiresOn, { date: formatDate(l.expiresAt, lang) })}
                    </p>
                  )}
                  <StatusActions
                    locale={lang}
                    listingId={l.id}
                    status={l.status}
                    dealType={l.dealType}
                    canRenew={canRenew}
                    publicHref={listingPath(lang, l.id, l.title)}
                    showSubmit
                    requireApproval={requireApproval}
                    dict={dict}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
