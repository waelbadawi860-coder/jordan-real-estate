import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportControls, UserStatusControls } from "@/components/admin/admin-controls";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { displayPhone, formatDate, t } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminUserPage({ params }: PageProps<"/[lang]/admin/users/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { user: me } = await requireAdminPage(lang, `/admin/users/${id}`);
  const dict = await getDictionary(lang);
  const a = dict.admin;
  const u = a.users;

  const supabase = await createClient();
  const [{ data: found }, { data: listings }, { data: reports }] = await Promise.all([
    supabase.rpc("admin_search_users", { p_query: id, p_limit: 1 }),
    supabase
      .from("listings")
      .select("id, title, status, created_at")
      .eq("seller_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_reports")
      .select("id, reason, details, status, created_at")
      .eq("reported_user_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const user = found?.[0];
  if (!user) notFound();

  const box = "rounded-2xl border border-border bg-surface p-4";
  return (
    <div className="flex flex-col gap-4">
      <section className={box}>
        <h2 className="mb-3 text-xl font-extrabold">
          {user.display_name}
          {user.role === "admin" && <span className="ms-2 rounded bg-brand-soft px-2 text-sm">{u.admin}</span>}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{u.email}</dt>
          <dd dir="ltr" className="text-start">
            {user.email}
          </dd>
          <dt className="text-muted">{u.phone}</dt>
          <dd dir="ltr" className="text-start">
            {user.phone ? displayPhone(user.phone) : "—"}
          </dd>
          <dt className="text-muted">{u.status}</dt>
          <dd className="font-bold">{u.statuses[user.status]}</dd>
          <dt className="text-muted">{u.joined}</dt>
          <dd>{formatDate(user.created_at, lang)}</dd>
          <dt className="text-muted">{u.lastLogin}</dt>
          <dd>{user.last_sign_in_at ? formatDate(user.last_sign_in_at, lang) : u.never}</dd>
        </dl>
        {user.status_reason && (
          <p className="mt-2 text-sm text-muted" dir="auto">
            {t(u.statusReason, { reason: user.status_reason })}
          </p>
        )}
        {user.deletion_requested_at && (
          <p className="mt-1 text-sm font-semibold text-accent">{t(u.deletionRequestedOn, { date: formatDate(user.deletion_requested_at, lang) })}</p>
        )}
      </section>

      <UserStatusControls userId={user.id} status={user.status} isSelf={user.id === me.id} a={a} />

      <section className={box}>
        <h3 className="mb-2 font-extrabold">{u.theirListings}</h3>
        {!listings?.length ? (
          <p className="text-sm text-muted">{a.listings.none}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {listings.map((l) => (
              <li key={l.id}>
                <Link href={localePath(lang, `/admin/listings/${l.id}`)} className="text-brand hover:underline" dir="auto">
                  #{l.id} · {l.title}
                </Link>{" "}
                <span className="text-muted">· {dict.status[l.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!!reports?.length && (
        <section className={box}>
          <h3 className="mb-2 font-extrabold">{a.reports.userReports}</h3>
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-col gap-1">
                <p className="text-sm">
                  <span className="font-bold">{dict.reportReasons[r.reason as keyof typeof dict.reportReasons] ?? r.reason}</span> ·{" "}
                  {a.reports.statuses[r.status]} · {formatDate(r.created_at, lang)}
                </p>
                {r.details && (
                  <p className="text-sm" dir="auto">
                    {r.details}
                  </p>
                )}
                <ReportControls kind="user" id={r.id} status={r.status} a={a} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
