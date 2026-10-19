import { notFound } from "next/navigation";
import { AgreementForm } from "@/components/admin/commission-controls";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { formatDate, t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminAgreementsPage({ params }: PageProps<"/[lang]/admin/agreements">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/agreements");
  const dict = await getDictionary(lang);
  const g = dict.admin.agreements;

  const supabase = await createClient();
  const [{ data: versions }, { data: acceptances }] = await Promise.all([
    supabase.from("agreement_versions").select("*").order("created_at", { ascending: false }),
    supabase.from("accepted_agreements").select("agreement_version_id"),
  ]);
  const counts = new Map<number, number>();
  for (const a of acceptances ?? []) counts.set(a.agreement_version_id, (counts.get(a.agreement_version_id) ?? 0) + 1);
  const current = versions?.find((v) => v.is_current);
  const box = "rounded-2xl border border-border bg-surface p-4";

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {(versions ?? []).map((v) => (
          <li key={v.id} className={box}>
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold" dir="ltr">
                {v.version_label}
              </span>
              {v.is_current && <span className="rounded bg-brand px-2 text-xs font-bold text-white">{g.current}</span>}
              <span className={`rounded px-2 text-xs font-bold ${v.is_draft ? "bg-accent-soft text-accent" : "bg-brand-soft text-brand-strong"}`}>
                {v.is_draft ? g.draft : g.reviewed}
              </span>
              <span className="text-xs text-muted">
                {formatDate(v.created_at, lang)} · {t(g.acceptances, { n: counts.get(v.id) ?? 0 })}
              </span>
            </p>
            {v.legal_review_note && (
              <p className="mt-1 text-xs text-muted" dir="auto">
                {v.legal_review_note}
              </p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-brand">{lang === "ar" ? v.title_ar : v.title_en}</summary>
              <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                <p className="whitespace-pre-line" dir="rtl">
                  {v.body_ar}
                </p>
                <p className="whitespace-pre-line" dir="ltr">
                  {v.body_en}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>

      <section className={box} aria-labelledby="new-version">
        <h2 id="new-version" className="mb-3 text-lg font-extrabold">
          {g.newVersion}
        </h2>
        <AgreementForm
          initial={{
            titleAr: current?.title_ar ?? "",
            titleEn: current?.title_en ?? "",
            bodyAr: current?.body_ar ?? "",
            bodyEn: current?.body_en ?? "",
          }}
          a={dict.admin}
          c={dict.commission}
        />
      </section>
    </div>
  );
}
