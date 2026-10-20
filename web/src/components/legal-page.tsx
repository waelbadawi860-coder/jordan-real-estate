import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_UPDATED, LEGAL_VERSION_SETTING, legalDoc, type LegalSlug } from "@/content/legal";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getReferenceData, siteName } from "@/lib/data/public";
import { formatDate } from "@/lib/format";

// Legal pages. Texts live in src/content/legal-*.ts; while the version is a
// draft (it starts with "draft") a clear notice says it awaits legal review.

export function legalMetadata(slug: LegalSlug) {
  return async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    if (!hasLocale(lang)) return {};
    return {
      title: legalDoc(lang, slug).title,
      alternates: { canonical: localePath(lang, `/${slug}`), languages: { ar: localePath("ar", `/${slug}`), en: localePath("en", `/${slug}`) } },
    };
  };
}

export function legalPage(slug: LegalSlug) {
  return async function LegalPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    if (!hasLocale(lang)) notFound();
    const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
    const doc = legalDoc(lang, slug);
    const version = String(ref.settings[LEGAL_VERSION_SETTING[slug]] ?? "");
    const email = typeof ref.settings.contact_email === "string" && ref.settings.contact_email ? ref.settings.contact_email : lang === "ar" ? "[بريد التواصل الرسمي، يُعلن قريبًا]" : "[official contact e-mail, coming soon]";
    const retention = String(ref.settings.removed_photo_retention_days ?? "365");
    const fill = (text: string) =>
      text.replaceAll("{email}", email).replaceAll("{site}", siteName(ref, lang)).replaceAll("{retention}", retention);

    const others = (["terms", "privacy", "posting-policy", "reporting-policy"] as const).filter((s) => s !== slug);

    return (
      <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold">{doc.title}</h1>
          <p className="text-sm text-muted">
            {dict.legal.version}: <span dir="ltr">{version}</span> · {dict.legal.updated}: {formatDate(`${LEGAL_UPDATED}T12:00:00Z`, lang)}
          </p>
          {version.startsWith("draft") && (
            <p role="note" className="rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm font-semibold">
              {dict.legal.draftNotice}
            </p>
          )}
          <p className="leading-relaxed">{fill(doc.intro)}</p>
        </header>

        {doc.sections.map((section) => (
          <section key={section.h} className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">{section.h}</h2>
            {section.p?.map((text, i) => (
              <p key={i} className="leading-relaxed">
                {fill(text)}
              </p>
            ))}
            {section.list && (
              <ul className="flex list-disc flex-col gap-1.5 ps-6 leading-relaxed">
                {section.list.map((text, i) => (
                  <li key={i}>{fill(text)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <nav className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-sm" aria-label={dict.legal.related}>
          {others.map((s) => (
            <Link key={s} href={localePath(lang, `/${s}`)} className="font-semibold text-brand hover:underline">
              {legalDoc(lang, s).title}
            </Link>
          ))}
        </nav>
      </article>
    );
  };
}
