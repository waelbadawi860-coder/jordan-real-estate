import { notFound } from "next/navigation";
import { pageFrom, Pager } from "@/components/admin/pager";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { ADMIN_PAGE_SIZE, requireAdminPage } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminAuditPage({ params, searchParams }: PageProps<"/[lang]/admin/audit">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/audit");
  const sp = await searchParams;
  const page = pageFrom(sp.page);
  const dict = await getDictionary(lang);
  const a = dict.admin.audit;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("admin_audit_logs")
    .select("id, action, entity_type, entity_id, details, created_at, profiles(display_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);

  const time = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO-u-nu-latn" : "en-JO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  });

  return (
    <section>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-background text-muted">
            <tr>
              <th className="p-2 text-start">{a.when}</th>
              <th className="p-2 text-start">{a.actor}</th>
              <th className="p-2 text-start">{a.action}</th>
              <th className="p-2 text-start">{a.entity}</th>
              <th className="p-2 text-start">{a.details}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap p-2">{time.format(new Date(row.created_at))}</td>
                <td className="p-2">{(row.profiles as { display_name: string } | null)?.display_name ?? a.system}</td>
                <td className="p-2 font-mono text-xs" dir="ltr">
                  {row.action}
                </td>
                <td className="p-2 font-mono text-xs" dir="ltr">
                  {row.entity_type}:{row.entity_id}
                </td>
                <td className="max-w-md p-2">
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-xs" dir="ltr">
                    {JSON.stringify(row.details, null, 1).slice(0, 1500)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        basePath={localePath(lang, "/admin/audit")}
        params={{}}
        page={page}
        total={count ?? 0}
        pageSize={ADMIN_PAGE_SIZE}
        text={{ prev: dict.admin.listings.prev, next: dict.admin.listings.next }}
      />
    </section>
  );
}
