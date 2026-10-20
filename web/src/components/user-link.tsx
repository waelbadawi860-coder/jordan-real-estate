import { Bell, UserRound } from "lucide-react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { getSessionUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/data/notifications";
import { t } from "@/lib/format";

/** "Log in", or the notifications bell plus "My account", depending on the session. */
export async function UserLink({
  locale,
  loginText,
  accountText,
  bellLabel,
}: {
  locale: Locale;
  loginText: string;
  accountText: string;
  bellLabel: string;
}) {
  const user = await getSessionUser();
  if (!user) return <UserLinkView locale={locale} text={loginText} href="/login" />;
  const unread = await getUnreadCount(user.id);
  return (
    <>
      <Link
        href={localePath(locale, "/my/notifications")}
        aria-label={t(bellLabel, { n: unread })}
        className="relative grid size-10 place-items-center rounded-lg hover:bg-brand-soft"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
      <UserLinkView locale={locale} text={accountText} href="/my/listings" />
    </>
  );
}

export function UserLinkView({ locale, text, href }: { locale: Locale; text: string; href: string }) {
  return (
    <Link
      href={localePath(locale, href)}
      className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-foreground hover:bg-brand-soft sm:px-3"
    >
      <UserRound className="size-4" aria-hidden />
      <span className="hidden sm:inline">{text}</span>
      <span className="sr-only sm:hidden">{text}</span>
    </Link>
  );
}
