import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitch } from "./language-switch";
import { UserLink, UserLinkView } from "./user-link";

export function SiteHeader({ locale, dict, siteName }: { locale: Locale; dict: Dictionary; siteName: string }) {
  const otherLocale: Locale = locale === "ar" ? "en" : "ar";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href={localePath(locale, "/")} className="flex items-center gap-2 text-[1.375rem] font-extrabold text-brand">
          {/* The logo (green tile with the «ع» building and map pin). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-96.png" alt="" width={40} height={40} className="size-10 rounded-lg" />
          {/* On very narrow phones only the logo icon shows, to leave room for the buttons. */}
          <span className="hidden min-[380px]:inline">{siteName}</span>
          <span className="sr-only min-[380px]:hidden">{siteName}</span>
        </Link>

        <nav className="ms-auto flex items-center gap-0.5 whitespace-nowrap sm:gap-2" aria-label={dict.nav.home}>
          <Link
            href={localePath(locale, "/search")}
            className="hidden items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-brand-soft sm:flex"
          >
            <Search className="size-4" aria-hidden />
            {dict.nav.search}
          </Link>
          <Suspense
            fallback={
              <Link href={localePath(otherLocale, "/")} lang={otherLocale} className="rounded-lg px-3 py-2 text-sm font-semibold">
                {dict.nav.language}
              </Link>
            }
          >
            <LanguageSwitch targetLocale={otherLocale} label={dict.nav.language} ariaLabel={dict.nav.languageLabel} />
          </Suspense>
          {/* Depends on the session cookie, so it streams in after the page shell. */}
          <Suspense fallback={<UserLinkView locale={locale} text={dict.nav.login} href="/login" />}>
            <UserLink locale={locale} loginText={dict.nav.login} accountText={dict.nav.myAccount} bellLabel={dict.notifications.bellLabel} />
          </Suspense>
          <Link
            href={localePath(locale, "/post")}
            className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-accent px-2.5 py-2 text-sm font-bold text-white hover:opacity-90 sm:px-3"
          >
            <Plus className="size-4" aria-hidden />
            {dict.nav.addProperty}
          </Link>
        </nav>
      </div>
    </header>
  );
}
