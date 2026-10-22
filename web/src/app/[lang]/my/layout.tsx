import { Bell, Building2, Gauge, HandCoins, Heart, LayoutList, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOwnProfile, requireUser } from "@/lib/auth";
import { hasAnyCommission, isCommissionEnabled } from "@/lib/data/commission";

// Everything under /my is private: the server checks the login on every
// request, and the database only ever returns the user's own rows.
export const instant = false;

export default async function MyLayout({ children, params }: LayoutProps<"/[lang]/my">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireUser(lang, "/my/listings");
  const [dict, profile, hasCommissions] = await Promise.all([getDictionary(lang), getOwnProfile(), hasAnyCommission(user.id)]);
  const showCommissions = hasCommissions || (await isCommissionEnabled());

  const tabs = [
    { href: "/my/listings", label: dict.account.navListings, icon: LayoutList },
    { href: "/my/favourites", label: dict.account.navFavourites, icon: Heart },
    { href: "/my/office", label: dict.office.nav, icon: Building2 },
    ...(showCommissions ? [{ href: "/my/commissions", label: dict.commission.nav, icon: HandCoins }] : []),
    { href: "/my/notifications", label: dict.notifications.title, icon: Bell },
    { href: "/my/account", label: dict.account.navAccount, icon: UserRound },
    { href: "/my/security", label: dict.security.nav, icon: ShieldCheck },
    // Only a convenience link: the admin pages check permissions themselves.
    ...(profile?.role === "admin" && profile.status === "active" ? [{ href: "/admin", label: dict.admin.title, icon: Gauge }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1" aria-label={dict.account.title}>
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={localePath(lang, href)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-foreground hover:bg-brand-soft"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction}>
          <input type="hidden" name="lang" value={lang} />
          <button type="submit" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-danger">
            {dict.auth.logout}
          </button>
        </form>
      </div>

      {profile?.status === "suspended" && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 font-semibold text-danger">
          {dict.account.suspended}
        </p>
      )}
      {profile?.status === "deletion_requested" && (
        <p role="status" className="mb-4 rounded-lg border border-accent/30 bg-accent-soft p-3 font-semibold">
          {dict.account.deletionPending}
        </p>
      )}

      {children}
    </div>
  );
}
