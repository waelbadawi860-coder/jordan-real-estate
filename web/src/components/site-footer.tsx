import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ locale, dict, siteName }: { locale: Locale; dict: Dictionary; siteName: string }) {
  const links = [
    { href: "/terms", label: dict.footer.terms },
    { href: "/privacy", label: dict.footer.privacy },
    { href: "/posting-policy", label: dict.footer.posting },
    { href: "/reporting-policy", label: dict.footer.reporting },
    { href: "/contact", label: dict.footer.contact },
  ];
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={dict.footer.terms}>
          {links.map((link) => (
            <Link key={link.href} href={localePath(locale, link.href)} className="hover:text-brand hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        <p>
          © {siteName} — {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
