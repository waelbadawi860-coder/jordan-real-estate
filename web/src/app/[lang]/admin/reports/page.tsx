import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportControls } from "@/components/admin/admin-controls";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminReportsPage({ params, searchParams }: PageProps<"/[lang]/admin/reports">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/reports");
  const sp = await searchParams;
  const showClosed = sp.closed === "1";
  const dict = await getDictionary(lang);
  const a = dict.admin;
  const statuses = showClosed ? ["open", "reviewing", "resolved", "dismissed"] : ["open", "reviewing"];

  const supabase = await createClient();
  const [listingReports, userReports, messages] = await Promise.all([
    supabase
      .from("listing_reports")
      .select("id, listing_id, reason, details, status, created_at, reporter_id, resolution_note, listings(title)")
      .in("status", statuses as ("open" | "reviewing" | "resolved" | "dismissed")[])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("user_reports")
      .select("id, reported_user_id, reason, details, status, created_at, reporter_id, resolution_note")
      .in("status", statuses as ("open" | "reviewing" | "resolved" | "dismissed")[])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("contact_messages")
      .select("id, topic, name, email, message, status, created_at, user_id, resolution_note")
      .in("status", statuses as ("open" | "reviewing" | "resolved" | "dismissed")[])
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  const box = "rounded-2xl border border-border bg-surface p-4";
  const reasonText = (r: string) => dict.reportReasons[r as keyof typeof dict.reportReasons] ?? r;
  const meta = (status: "open" | "reviewing" | "resolved" | "dismissed", createdAt: string, anonymous: boolean) =>
    `${a.reports.statuses[status]} · ${formatDate(createdAt, lang)} · ${a.reports.reporter}: ${anonymous ? a.reports.visitor : "✓"}`;

  return (
    <div className="flex flex-col gap-5">
      <Link href={`${localePath(lang, "/admin/reports")}${showClosed ? "" : "?closed=1"}`} className="w-fit text-sm font-bold text-brand hover:underline">
        {showClosed ? a.reports.statuses.open : a.reports.showClosed}
      </Link>

      <section className={box} aria-labelledby="lr">
        <h2 id="lr" className="mb-3 text-lg font-extrabold">
          {a.reports.listingReports}
        </h2>
        {!listingReports.data?.length ? (
          <p className="text-sm text-muted">{a.reports.none}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {listingReports.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-b border-border pb-4 last:border-b-0">
                <Link href={localePath(lang, `/admin/listings/${r.listing_id}`)} className="font-bold text-brand hover:underline" dir="auto">
                  #{r.listing_id} · {(r.listings as { title: string } | null)?.title}
                </Link>
                <span className="text-xs font-bold text-muted" dir="ltr">
                  L-{r.id}
                </span>
                <p className="text-sm">
                  <span className="font-semibold">{reasonText(r.reason)}</span> — {meta(r.status, r.created_at, !r.reporter_id)}
                </p>
                {r.details && (
                  <p className="text-sm" dir="auto">
                    {r.details}
                  </p>
                )}
                {r.resolution_note && (
                  <p className="text-xs text-muted" dir="auto">
                    {r.resolution_note}
                  </p>
                )}
                <ReportControls kind="listing" id={r.id} status={r.status} a={a} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={box} aria-labelledby="ur">
        <h2 id="ur" className="mb-3 text-lg font-extrabold">
          {a.reports.userReports}
        </h2>
        {!userReports.data?.length ? (
          <p className="text-sm text-muted">{a.reports.none}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {userReports.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-b border-border pb-4 last:border-b-0">
                <Link href={localePath(lang, `/admin/users/${r.reported_user_id}`)} className="font-bold text-brand hover:underline">
                  {a.reports.reportedUser}
                </Link>
                <span className="text-xs font-bold text-muted" dir="ltr">
                  U-{r.id}
                </span>
                <p className="text-sm">
                  <span className="font-semibold">
                    {dict.contact.sellerReasons[r.reason as keyof typeof dict.contact.sellerReasons] ?? reasonText(r.reason)}
                  </span> — {meta(r.status, r.created_at, !r.reporter_id)}
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
        )}
      </section>

      <section id="messages" className={box} aria-labelledby="cm">
        <h2 id="cm" className="mb-3 text-lg font-extrabold">
          {a.reports.messages}
        </h2>
        {!messages.data?.length ? (
          <p className="text-sm text-muted">{a.reports.none}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.data.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 border-b border-border pb-4 last:border-b-0">
                <span className="text-xs font-bold text-muted" dir="ltr">
                  M-{m.id}
                </span>
                <p className="text-sm">
                  <span className="font-semibold">{dict.contact.topics[m.topic as keyof typeof dict.contact.topics]}</span> —{" "}
                  {a.reports.statuses[m.status]} · {formatDate(m.created_at, lang)}
                </p>
                <p className="text-sm text-muted">
                  {m.name ?? "—"}
                  {m.email && (
                    <>
                      {" · "}
                      <a href={`mailto:${m.email}`} className="text-brand underline" dir="ltr">
                        {m.email}
                      </a>
                    </>
                  )}
                  {m.user_id && (
                    <>
                      {" · "}
                      <Link href={localePath(lang, `/admin/users/${m.user_id}`)} className="text-brand underline">
                        {a.nav.users}
                      </Link>
                    </>
                  )}
                </p>
                <p className="whitespace-pre-line text-sm" dir="auto">
                  {m.message}
                </p>
                <ReportControls kind="message" id={m.id} status={m.status} a={a} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
