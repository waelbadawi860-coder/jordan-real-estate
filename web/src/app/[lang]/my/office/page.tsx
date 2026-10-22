import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfficeForm, VerificationForm } from "@/components/office-forms";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getMyOffice, getOfficePlans, isActiveUntil } from "@/lib/data/offices";
import { getReferenceData } from "@/lib/data/public";
import { formatDate, formatPrice, t } from "@/lib/format";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/office">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).office.title, robots: { index: false } };
}

export default async function MyOfficePage({ params }: PageProps<"/[lang]/my/office">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireUser(lang, "/my/office");
  const [dict, ref, office, plans] = await Promise.all([getDictionary(lang), getReferenceData(), getMyOffice(user.id), getOfficePlans()]);
  const o = dict.office;
  const section = "rounded-2xl border border-border bg-surface p-5";
  const verified = office ? isActiveUntil(office.verifiedUntil) : false;
  const planActive = office ? isActiveUntil(office.planUntil) : false;
  const currentPlan = plans.find((p) => p.slug === office?.planSlug);
  const individualLimit = Number(ref.settings.max_active_listings_individual ?? 3);
  const request = office?.latestRequest;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={section} aria-labelledby="office-heading">
        <h1 id="office-heading" className="mb-1 flex items-center gap-2 text-xl font-extrabold">
          {o.title}
          {verified && (
            <span className="flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
              <BadgeCheck className="size-3.5" aria-hidden />
              {o.verifiedBadge}
            </span>
          )}
        </h1>
        <p className="mb-4 text-sm text-muted">{office ? o.editIntro : o.createIntro}</p>
        {office?.status === "suspended" && (
          <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger">
            {o.suspended}
          </p>
        )}
        <OfficeForm locale={lang} text={o} form={dict.form} cities={ref.cities} office={office} />
        {office && (
          <p className="mt-4 text-sm">
            <Link href={localePath(lang, `/office/${office.id}`)} className="font-bold text-brand hover:underline">
              {o.viewPublic}
            </Link>
          </p>
        )}
      </section>

      <div className="flex flex-col gap-5">
        <section className={section} aria-labelledby="verify-heading">
          <h2 id="verify-heading" className="mb-2 text-xl font-extrabold">
            {o.verifyTitle}
          </h2>
          <p className="mb-4 text-sm text-muted">{o.verifyIntro}</p>
          {!office ? (
            <p className="text-sm">{o.createFirst}</p>
          ) : verified ? (
            <p className="font-semibold text-brand">{t(o.verifiedUntil, { date: formatDate(office.verifiedUntil!, lang) })}</p>
          ) : request?.status === "pending" ? (
            <p className="font-semibold">{t(o.requestPending, { date: formatDate(request.createdAt, lang) })}</p>
          ) : (
            <>
              {request?.status === "rejected" && (
                <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm font-semibold text-danger">
                  {t(o.requestRejected, { reason: request.reason ?? "—" })}
                </p>
              )}
              <VerificationForm userId={user.id} text={o} />
            </>
          )}
        </section>

        <section className={section} aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="mb-2 text-xl font-extrabold">
            {o.plansTitle}
          </h2>
          <p className="mb-3 text-sm">
            {planActive && currentPlan
              ? t(o.currentPlan, { plan: currentPlan.name[lang], date: formatDate(office!.planUntil!, lang), n: currentPlan.maxActiveListings })
              : t(o.noPlan, { n: individualLimit })}
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <li key={p.slug} className={`rounded-xl border p-3 ${p.slug === office?.planSlug && planActive ? "border-brand bg-brand-soft" : "border-border"}`}>
                <p className="font-extrabold">{p.name[lang]}</p>
                <p className="text-lg font-bold text-brand-strong">
                  {formatPrice(p.priceJod, lang, dict.common.currency)} <span className="text-sm font-normal text-muted">/ {o.perMonth}</span>
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  <li>{t(o.planListings, { n: p.maxActiveListings })}</li>
                  {p.featuredPerMonth > 0 && <li>{t(o.planFeatured, { n: p.featuredPerMonth })}</li>}
                  <li>{p.includesVerification ? o.planVerificationIncluded : o.planVerificationExtra}</li>
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            {o.howToSubscribe}{" "}
            <Link href={`${localePath(lang, "/contact")}?topic=office`} className="font-bold text-brand hover:underline">
              {o.contactUs}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
