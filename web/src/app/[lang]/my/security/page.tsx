import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MfaPanel } from "@/components/mfa-panel";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { safeNextPath } from "@/lib/auth";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/security">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).security.title, robots: { index: false } };
}

export default async function SecurityPage({ params, searchParams }: PageProps<"/[lang]/my/security">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, sp] = await Promise.all([getDictionary(lang), searchParams]);
  const rawNext = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = rawNext ? safeNextPath(rawNext, "") || null : null;

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-surface p-5" aria-labelledby="security-heading">
      <h1 id="security-heading" className="text-xl font-extrabold">
        {dict.security.title}
      </h1>
      {next && <p className="rounded-lg bg-accent-soft p-3 text-sm font-semibold">{dict.security.adminRequired}</p>}
      <p className="text-sm text-muted">{dict.security.intro}</p>
      <MfaPanel text={dict.security} next={next} />
    </section>
  );
}
