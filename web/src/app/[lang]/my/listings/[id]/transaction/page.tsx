import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RuleSummary } from "@/components/commission/rule-summary";
import { TransactionForm } from "@/components/commission/transaction-form";
import { FormMessage } from "@/components/form-controls";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getAcceptedRule } from "@/lib/data/commission";
import { getMyListing } from "@/lib/data/owner";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/listings/[id]/transaction">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).commission.transactionTitle, robots: { index: false } };
}

function ammanToday(): string {
  // Dates are entered in Jordan's time zone.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
}

export default async function TransactionPage({ params }: PageProps<"/[lang]/my/listings/[id]/transaction">) {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang) || !/^\d{1,15}$/.test(rawId)) notFound();
  const id = Number(rawId);
  const user = await requireUser(lang, `/my/listings/${id}/transaction`);
  const [dict, listing, rule] = await Promise.all([getDictionary(lang), getMyListing(user.id, id), getAcceptedRule(id)]);
  if (!listing) notFound();
  // Listings without a commission agreement use the normal "mark as sold" button.
  if (!rule) redirect(localePath(lang, "/my/listings"));

  const c = dict.commission;
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <h1 className="text-2xl font-extrabold">{c.transactionTitle}</h1>
      <p className="font-semibold" dir="auto">
        #{listing.id} · {listing.title}
      </p>
      {listing.status === "published" || listing.status === "expired" ? (
        <>
          <p className="text-sm text-muted">{c.transactionIntro}</p>
          <div className="rounded-lg bg-background p-3">
            <h2 className="mb-1 text-sm font-bold">{c.rulesTitle}</h2>
            <RuleSummary rule={rule} dict={dict} locale={lang} />
          </div>
          <TransactionForm listingId={listing.id} rule={rule} today={ammanToday()} locale={lang} dict={dict} />
        </>
      ) : (
        <FormMessage kind="info">{c.errors.invalid_status_transition}</FormMessage>
      )}
    </section>
  );
}
