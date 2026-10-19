import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { RegisterForm } from "@/components/auth-forms";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSessionUser } from "@/lib/auth";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/register">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).auth.registerTitle, robots: { index: false } };
}

export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  if (await getSessionUser()) redirect(localePath(lang, "/my/listings"));
  const dict = await getDictionary(lang);

  return (
    <AuthCard title={dict.auth.registerTitle}>
      <RegisterForm locale={lang} a={dict.auth} links={{ terms: dict.footer.terms, privacy: dict.footer.privacy }} />
    </AuthCard>
  );
}
