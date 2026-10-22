import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfficeAdminControls, OfficeReviewControls, PlanEditor } from "@/components/admin/admin-controls";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { isActiveUntil } from "@/lib/data/offices";
import { formatDate, formatDateTime, t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminOfficesPage({ params }: PageProps<"/[lang]/admin/offices">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/offices");
  const dict = await getDictionary(lang);
  const a = dict.admin;
  const o = a.offices;

  const supabase = await createClient();
  const [{ data: requests }, { data: offices }, { data: planRows }] = await Promise.all([
    supabase
      .from("office_verifications")
      .select("id, office_id, commercial_reg_no, license_no, documents, created_at, offices(id, name)")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("offices")
      .select("id, name, status, plan_slug, plan_until, verified_until, created_at, profiles!offices_owner_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("office_plans").select("*").order("sort_order"),
  ]);

  // Admins may read private documents (storage policy), via short-lived links.
  const paths = (requests ?? []).flatMap((r) => r.documents);
  const { data: signed } = paths.length ? await supabase.storage.from("office-documents").createSignedUrls(paths, 600) : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const plans = (planRows ?? []).map((p) => ({
    slug: p.slug,
    name: { ar: p.name_ar, en: p.name_en },
    priceJod: Number(p.price_jod),
    maxActiveListings: p.max_active_listings,
    featuredPerMonth: p.featured_per_month,
    includesVerification: p.includes_verification,
    isActive: p.is_active,
  }));
  const box = "rounded-2xl border border-border bg-surface p-4";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold">{o.title}</h2>

      <section className={`${box} flex flex-col gap-3`} aria-labelledby="queue-heading">
        <h3 id="queue-heading" className="font-extrabold">
          {o.queue}
        </h3>
        {!requests?.length ? (
          <p className="text-sm text-muted">{o.noQueue}</p>
        ) : (
          requests.map((r) => {
            const office = r.offices as { id: number; name: string } | null;
            return (
              <article key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p className="font-bold" dir="auto">
                  {office?.name} · {o.submitted}: {formatDateTime(r.created_at, lang)}
                </p>
                <p className="text-sm">
                  {o.regNo}: <span dir="ltr">{r.commercial_reg_no ?? "—"}</span> · {o.licenseNo}: <span dir="ltr">{r.license_no ?? "—"}</span>
                </p>
                <ul className="flex flex-wrap gap-2 text-sm">
                  {r.documents.map((path, i) => (
                    <li key={path}>
                      <a href={urlOf.get(path) ?? "#"} target="_blank" rel="noopener noreferrer" className="font-bold text-brand hover:underline">
                        {t(o.document, { n: i + 1 })}
                      </a>
                    </li>
                  ))}
                </ul>
                <OfficeReviewControls requestId={r.id} a={a} />
              </article>
            );
          })
        )}
      </section>

      <section className={`${box} flex flex-col gap-3`} aria-labelledby="offices-heading">
        <h3 id="offices-heading" className="font-extrabold">
          {o.offices}
        </h3>
        {!offices?.length ? (
          <p className="text-sm text-muted">{o.noOffices}</p>
        ) : (
          offices.map((office) => {
            const owner = office.profiles as { display_name: string } | null;
            const verified = isActiveUntil(office.verified_until);
            const planName = plans.find((p) => p.slug === office.plan_slug)?.name[lang];
            return (
              <details key={office.id} className="rounded-lg border border-border p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-bold" dir="auto">
                    {office.name}
                  </span>
                  {verified && <BadgeCheck className="size-4 text-brand" aria-label={dict.office.verifiedBadge} />}
                  {office.status === "suspended" && <span className="font-bold text-danger">{o.suspend}</span>}
                  <span className="text-muted">
                    {o.owner}: {owner?.display_name ?? "—"}
                  </span>
                  <span className="text-muted">
                    {o.plan}: {isActiveUntil(office.plan_until) && planName ? `${planName} (${o.planUntil} ${formatDate(office.plan_until!, lang)})` : o.none}
                  </span>
                  <span className="text-muted">
                    {o.verified}: {verified ? formatDate(office.verified_until!, lang) : o.none}
                  </span>
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <Link href={localePath(lang, `/office/${office.id}`)} className="text-sm font-bold text-brand hover:underline">
                    {dict.office.viewPublic}
                  </Link>
                  <OfficeAdminControls
                    officeId={office.id}
                    plans={plans.filter((p) => p.isActive)}
                    verified={verified}
                    suspended={office.status === "suspended"}
                    locale={lang}
                    a={a}
                  />
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className={`${box} flex flex-col gap-3`} aria-labelledby="plans-heading">
        <h3 id="plans-heading" className="font-extrabold">
          {o.plans}
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((p) => (
            <PlanEditor key={p.slug} plan={p} locale={lang} a={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
