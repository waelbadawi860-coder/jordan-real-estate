import { BadgeCheck, Eye, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getReferenceData } from "@/lib/data/public";
import { t } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.about.title,
    description: dict.about.intro,
    alternates: { canonical: localePath(lang, "/about"), languages: { ar: localePath("ar", "/about"), en: localePath("en", "/about") } },
  };
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const a = dict.about;
  const sections = [
    { icon: Eye, title: a.reviewTitle, text: t(a.reviewText, { d: Number(ref.settings.listing_expiry_days ?? 30) }) },
    { icon: Search, title: a.searchTitle, text: a.searchText },
    { icon: BadgeCheck, title: a.verifiedTitle, text: a.verifiedText },
    { icon: ShieldCheck, title: a.safetyTitle, text: a.safetyText },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-2xl font-extrabold">{a.title}</h1>
        <p className="mt-2 text-lg">{a.intro}</p>
      </header>
      {sections.map(({ icon: Icon, title, text }) => (
        <section key={title} className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <Icon className="size-5 text-brand" aria-hidden />
            {title}
          </h2>
          <p className="mt-1">{text}</p>
        </section>
      ))}
      <p className="text-sm text-muted">{a.disclaimer}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={localePath(lang, "/pricing")} className="rounded-lg bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong">
          {a.ctaPricing}
        </Link>
        <Link href={localePath(lang, "/posting-policy")} className="rounded-lg border border-border bg-surface px-4 py-2 font-bold hover:border-brand">
          {a.ctaPolicy}
        </Link>
      </div>
    </div>
  );
}
