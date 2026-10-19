import { UserRound } from "lucide-react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { getSessionUser } from "@/lib/auth";

/** "Log in" or "My account", depending on the visitor's session. */
export async function UserLink({ locale, loginText, accountText }: { locale: Locale; loginText: string; accountText: string }) {
  const user = await getSessionUser();
  return <UserLinkView locale={locale} text={user ? accountText : loginText} href={user ? "/my/listings" : "/login"} />;
}

export function UserLinkView({ locale, text, href }: { locale: Locale; text: string; href: string }) {
  return (
    <Link
      href={localePath(locale, href)}
      className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-brand-soft"
    >
      <UserRound className="size-4" aria-hidden />
      <span className="hidden sm:inline">{text}</span>
      <span className="sr-only sm:hidden">{text}</span>
    </Link>
  );
}
