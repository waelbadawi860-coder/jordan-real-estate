import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { AcceptTermsForm } from "@/components/accept-terms-form";
import { DeleteAccountForm } from "@/components/account-forms";
import { AuthCard } from "@/components/auth-card";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser, safeNextPath } from "@/lib/auth";
import { getPendingConsents } from "@/lib/consent";
import { t } from "@/lib/format";

// Shown when the terms or privacy policy changed since the user last agreed.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/accept-terms">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).consent.title, robots: { index: false } };
}

export default async function AcceptTermsPage({ params, searchParams }: PageProps<"/[lang]/accept-terms">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const sp = await searchParams;
  const next = safeNextPath(Array.isArray(sp.next) ? sp.next[0] : sp.next, localePath(lang, "/my/listings"));
  await requireUser(lang, "/accept-terms");

  const pending = await getPendingConsents();
  if (pending.length === 0) redirect(next);

  const dict = await getDictionary(lang);
  const c = dict.consent;
  const docs = { terms: { label: dict.footer.terms, href: "/terms" }, privacy: { label: dict.footer.privacy, href: "/privacy" } };

  return (
    <AuthCard title={c.title}>
      <div className="flex flex-col gap-5">
        <p className="text-sm">{c.intro}</p>
        <ul className="flex flex-col gap-2">
          {pending.map((p) => (
            <li key={p.document} className="rounded-lg border border-border p-3 text-sm">
              <Link href={localePath(lang, docs[p.document].href)} target="_blank" className="font-bold text-brand underline">
                {docs[p.document].label}
              </Link>{" "}
              <span className="text-muted">{t(c.version, { v: p.version })}</span>
            </li>
          ))}
        </ul>
        <AcceptTermsForm locale={lang} next={next} c={c} />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted">{c.decline}</p>
          <form action={logoutAction}>
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className="text-sm font-bold text-brand hover:underline">
              {dict.auth.logout}
            </button>
          </form>
          <DeleteAccountForm locale={lang} dict={dict} />
        </div>
      </div>
    </AuthCard>
  );
}
