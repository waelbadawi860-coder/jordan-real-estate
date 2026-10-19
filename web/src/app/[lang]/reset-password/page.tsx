import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { NewPasswordForm } from "@/components/auth-forms";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSessionUser } from "@/lib/auth";

// Reached from the password-reset email, which logs the person in first.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/reset-password">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).auth.resetTitle, robots: { index: false } };
}

export default async function ResetPasswordPage({ params }: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  if (!(await getSessionUser())) redirect(`${localePath(lang, "/forgot-password")}?error=link`);
  const dict = await getDictionary(lang);

  return (
    <AuthCard title={dict.auth.resetTitle}>
      <NewPasswordForm a={dict.auth} />
    </AuthCard>
  );
}
