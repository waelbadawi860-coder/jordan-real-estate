import { notFound } from "next/navigation";
import { BlockListForm, RemoveBlockedButton } from "@/components/admin/admin-controls";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { displayPhone, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function BlockListPage({ params }: PageProps<"/[lang]/admin/blocklist">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/blocklist");
  const dict = await getDictionary(lang);
  const b = dict.admin.blocklist;

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("blocked_identifiers")
    .select("id, kind, value, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Loading the block list failed: ${error.message}`);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg font-extrabold">{b.title}</h2>
      <p className="text-sm text-muted">{b.intro}</p>
      <BlockListForm a={dict.admin} />
      {!rows?.length ? (
        <p className="text-sm text-muted">{b.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-bold" dir="ltr">
                  {r.kind === "phone" ? displayPhone(r.value) : r.value}
                </span>{" "}
                · {r.kind === "phone" ? b.phone : b.email} · <span dir="auto">{r.reason}</span> ·{" "}
                <span className="text-muted">{formatDateTime(r.created_at, lang)}</span>
              </span>
              <RemoveBlockedButton id={r.id} a={dict.admin} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
