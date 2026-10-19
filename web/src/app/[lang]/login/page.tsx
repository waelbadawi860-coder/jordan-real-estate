import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/auth-forms";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSessionUser, safeNextPath } from "@/lib/auth";

// Reads the session cookie, so it renders per request.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).auth.loginTitle, robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const sp = await searchParams;
  const next = safeNextPath(sp.next, localePath(lang, "/my/listings"));
  if (await getSessionUser()) redirect(next);

  const dict = await getDictionary(lang);
  const notice =
    sp.deleted === "1"
      ? dict.account.deleteRequested
      : sp.confirmed === "1"
        ? dict.auth.confirmedLogin
        : sp.error === "link"
          ? dict.auth.linkInvalid
          : sp.next
            ? dict.auth.loginRequired
            : undefined;

  return (
    <AuthCard title={dict.auth.loginTitle}>
      <LoginForm locale={lang} a={dict.auth} next={next} notice={notice} />
    </AuthCard>
  );
}
