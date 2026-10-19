"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { localePath, stripLocale, type Locale } from "@/i18n/config";

/** Link to the same page (and filters) in the other language. */
export function LanguageSwitch({ targetLocale, label, ariaLabel }: { targetLocale: Locale; label: string; ariaLabel: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = localePath(targetLocale, stripLocale(pathname)) + (search ? `?${search}` : "");

  return (
    <Link
      href={href}
      lang={targetLocale}
      hrefLang={targetLocale}
      aria-label={ariaLabel}
      className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-brand-soft"
    >
      {label}
    </Link>
  );
}
