import { BadgeCheck, Eye, Search } from "lucide-react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** Three short reasons to use the site, under the search on the home page. */
export function WhyUs({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const w = dict.whyUs;
  const items = [
    { icon: Eye, title: w.reviewed, text: w.reviewedText, href: "/about" },
    { icon: Search, title: w.propertyOnly, text: w.propertyOnlyText, href: "/search" },
    { icon: BadgeCheck, title: w.verified, text: w.verifiedText, href: "/pricing" },
  ];
  return (
    <section aria-label={w.title} className="grid gap-1.5 sm:grid-cols-3 sm:gap-2">
      {items.map(({ icon: Icon, title, text, href }) => (
        <Link
          key={title}
          href={localePath(locale, href)}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 hover:border-brand sm:items-start sm:p-3"
        >
          <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <span>
            <span className="block text-sm font-bold">{title}</span>
            <span className="hidden text-xs text-muted sm:block">{text}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
