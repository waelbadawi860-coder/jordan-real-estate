import { Ban, ClipboardList, Download, FileSignature, Flag, Gauge, HandCoins, Home, MapPin, Percent, ScrollText, Settings, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";

export const instant = false;

export async function generateMetadata({ params }: LayoutProps<"/[lang]/admin">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).admin.title, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children, params }: LayoutProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin");
  const dict = await getDictionary(lang);
  const n = dict.admin.nav;

  const links = [
    { href: "/admin", label: n.overview, icon: Gauge },
    { href: "/admin/listings", label: n.listings, icon: ClipboardList },
    { href: "/admin/users", label: n.users, icon: Users },
    { href: "/admin/reports", label: n.reports, icon: Flag },
    { href: "/admin/blocklist", label: n.blocklist, icon: Ban },
    { href: "/admin/commissions", label: n.commissions, icon: HandCoins },
    { href: "/admin/agreements", label: n.agreements, icon: FileSignature },
    { href: "/admin/rules", label: n.rules, icon: Percent },
    { href: "/admin/settings", label: n.settings, icon: Settings },
    { href: "/admin/locations", label: n.locations, icon: MapPin },
    { href: "/admin/types", label: n.types, icon: Home },
    { href: "/admin/audit", label: n.audit, icon: ScrollText },
    { href: "/admin/export", label: n.export, icon: Download },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold">{dict.admin.title}</h1>
      <div className="flex flex-col gap-5 lg:flex-row">
        <nav aria-label={dict.admin.title} className="lg:w-56 lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 lg:flex-col">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={localePath(lang, href)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold hover:bg-brand-soft"
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
