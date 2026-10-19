import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";

// Temporary pages for features built in later stages. They are excluded from
// search engines and clearly say they are not ready.

type TitleKey = (d: Dictionary) => string;

export function comingSoonMetadata(title: TitleKey) {
  return async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    if (!hasLocale(lang)) return {};
    return { title: title(await getDictionary(lang)), robots: { index: false } };
  };
}

export function comingSoonPage(title: TitleKey, legal = false) {
  return async function ComingSoonPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    if (!hasLocale(lang)) notFound();
    const dict = await getDictionary(lang);
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-extrabold">{title(dict)}</h1>
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">
          {dict.common.comingSoon}
          {legal && <span className="mt-2 block">{dict.common.legalDraft}</span>}
        </p>
      </div>
    );
  };
}
