import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteAccountForm, ProfileForm } from "@/components/account-forms";
import { NewPasswordForm } from "@/components/auth-forms";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOwnProfile, getSessionUser } from "@/lib/auth";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/account">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).account.title, robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/my/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, profile, user] = await Promise.all([getDictionary(lang), getOwnProfile(), getSessionUser()]);
  if (!profile) notFound();

  const section = "rounded-2xl border border-border bg-surface p-5";
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={section} aria-labelledby="profile-heading">
        <h1 id="profile-heading" className="mb-1 text-xl font-extrabold">
          {dict.account.profile}
        </h1>
        <p className="mb-4 text-sm text-muted" dir="ltr">
          {user?.email}
        </p>
        <ProfileForm
          dict={dict}
          profile={{ displayName: profile.displayName, phone: profile.phone, preferredLanguage: profile.preferredLanguage }}
        />
      </section>

      <div className="flex flex-col gap-5">
        <section className={section} aria-labelledby="password-heading">
          <h2 id="password-heading" className="mb-4 text-xl font-extrabold">
            {dict.account.changePassword}
          </h2>
          <NewPasswordForm a={dict.auth} />
        </section>

        {profile.status !== "deletion_requested" && (
          <section className={section} aria-labelledby="delete-heading">
            <h2 id="delete-heading" className="mb-2 text-xl font-extrabold text-danger">
              {dict.account.deleteTitle}
            </h2>
            <DeleteAccountForm locale={lang} dict={dict} />
          </section>
        )}
      </div>
    </div>
  );
}
