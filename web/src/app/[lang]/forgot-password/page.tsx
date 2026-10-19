import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/forgot-password">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).auth.forgotTitle, robots: { index: false } };
}

export default async function ForgotPasswordPage({ params, searchParams }: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const { error } = await searchParams;

  return (
    <AuthCard title={dict.auth.forgotTitle}>
      <ForgotPasswordForm locale={lang} a={dict.auth} linkError={error === "link"} />
    </AuthCard>
  );
}
