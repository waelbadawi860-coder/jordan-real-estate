import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";

export const instant = false;

export default async function AdminExportPage({ params }: PageProps<"/[lang]/admin/export">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/export");
  const dict = await getDictionary(lang);
  const e = dict.admin.export;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <p>{e.intro}</p>
      <ul className="flex flex-wrap gap-3">
        {(["listings", "users", "reports", "commissions"] as const).map((kind) => (
          <li key={kind}>
            {/* Plain links: the browser downloads the file directly. */}
            <a
              href={localePath(lang, `/admin/export/${kind}`)}
              className="flex h-11 items-center gap-2 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-strong"
            >
              <Download className="size-4" aria-hidden />
              {e.download}: {e[kind]}
            </a>
          </li>
        ))}
      </ul>
      <p className="rounded-lg bg-accent-soft p-3 text-sm">{e.note}</p>
    </section>
  );
}
