import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingModeration, RecheckRiskButton, ReportControls } from "@/components/admin/admin-controls";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { getReferenceData } from "@/lib/data/public";
import { displayPhone, formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { listingPath } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminListingPage({ params }: PageProps<"/[lang]/admin/listings/[id]">) {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang) || !/^\d{1,15}$/.test(rawId)) notFound();
  const id = Number(rawId);
  await requireAdminPage(lang, `/admin/listings/${id}`);
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const a = dict.admin;

  const supabase = await createClient();
  const [{ data: listing }, { data: history }, { data: reports }, { data: versions }, { data: declarations }, { data: risk }] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, status, price, deal_type, property_type_id, city_id, neighborhood_id, area_sqm, description, poster_type, seller_id, submitted_at, expires_at, profiles!listings_seller_id_fkey(display_name, status), listing_contacts(phone, allow_calls, allow_whatsapp), listing_images(id, storage_path, position)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("listing_status_history")
      .select("id, from_status, to_status, reason, created_at, profiles!listing_status_history_changed_by_fkey(display_name)")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("listing_reports")
      .select("id, reason, details, status, created_at, resolution_note")
      .eq("listing_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("listing_versions")
      .select("id, kind, changed_by, data, created_at")
      .eq("listing_id", id)
      .order("id", { ascending: true })
      .limit(200),
    supabase
      .from("listing_declarations")
      .select("id, version, created_at")
      .eq("listing_id", id)
      .order("id", { ascending: false }),
    supabase.from("listing_risk").select("flags, checked_at").eq("listing_id", id).maybeSingle(),
  ]);
  if (!listing) notFound();

  // Admins may read private photos (storage policy), via short-lived links.
  const images = [...listing.listing_images].sort((x, y) => x.position - y.position);
  const { data: signed } = images.length
    ? await supabase.storage.from("listing-photos").createSignedUrls(images.map((i) => i.storage_path), 600)
    : { data: [] };
  const contact = Array.isArray(listing.listing_contacts) ? listing.listing_contacts[0] : listing.listing_contacts;
  const seller = listing.profiles as { display_name: string; status: string } | null;
  const type = ref.propertyTypes.find((p) => p.id === listing.property_type_id);
  const city = ref.cities.find((c) => c.id === listing.city_id);
  const hood = ref.neighborhoods.find((n) => n.id === listing.neighborhood_id);

  // What changed in each version, compared with the previous one of the same kind.
  function versionChanges(rows: { id: number; kind: string; changed_by: string | null; data: unknown; created_at: string }[]) {
    const previous: Record<string, Record<string, unknown>> = {};
    const show = (value: unknown) => {
      const text = value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
      return text.length > 120 ? `${text.slice(0, 120)}…` : text;
    };
    return rows.map((row) => {
      const data = (row.data ?? {}) as Record<string, unknown>;
      const before = previous[row.kind];
      const changes =
        before && (row.kind === "content" || row.kind === "contact")
          ? Object.keys(data)
              .filter((key) => JSON.stringify(data[key]) !== JSON.stringify(before[key]))
              .map((key) => ({ field: key, before: show(before[key]), after: show(data[key]) }))
          : row.kind.startsWith("photo")
            ? [{ field: "path", before: "", after: show(data.path) }]
            : [];
      previous[row.kind] = data;
      return {
        id: row.id,
        kind: row.kind as "content" | "contact" | "photo_added" | "photo_removed",
        createdAt: row.created_at,
        bySeller: row.changed_by !== null && row.changed_by === listing!.seller_id,
        byAdmin: row.changed_by !== null && row.changed_by !== listing!.seller_id,
        changes,
      };
    }).reverse();
  }

  const box = "rounded-2xl border border-border bg-surface p-4";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-extrabold" dir="auto">
          #{listing.id} · {listing.title}
        </h2>
        <span className="rounded-md bg-accent-soft px-2 py-0.5 text-sm font-bold">{dict.status[listing.status]}</span>
        {listing.status === "published" && (
          <Link href={listingPath(lang, listing.id, listing.title)} className="text-sm font-bold text-brand hover:underline">
            {a.listing.viewPublic}
          </Link>
        )}
      </div>

      <section className={`${box} flex flex-col gap-2`} aria-labelledby="risk-heading">
        <h3 id="risk-heading" className="font-extrabold">
          {a.risk.title}
        </h3>
        {!risk ? (
          <p className="text-sm text-muted">{a.risk.notChecked}</p>
        ) : risk.flags.length === 0 ? (
          <p className="text-sm">{a.risk.none}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {risk.flags.map((flag) => (
              <li key={flag} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
                {a.risk.flags[flag as keyof typeof a.risk.flags] ?? flag}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          {risk && `${a.risk.checkedAt}: ${formatDateTime(risk.checked_at, lang)} · `}
          {a.risk.hint}
        </p>
        <RecheckRiskButton listingId={listing.id} a={a} />
      </section>

      <ListingModeration listingId={listing.id} status={listing.status} a={a} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={box}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{dict.listing.price}</dt>
            <dd className="font-bold">{formatPrice(Number(listing.price), lang, dict.common.currency)}</dd>
            <dt className="text-muted">{dict.listing.type}</dt>
            <dd>
              {type?.name[lang]} · {listing.deal_type === "sale" ? dict.search.sale : dict.search.rent}
            </dd>
            <dt className="text-muted">{dict.listing.location}</dt>
            <dd>{[hood?.name[lang], city?.name[lang]].filter(Boolean).join(" · ")}</dd>
            <dt className="text-muted">{dict.listing.area}</dt>
            <dd>{listing.area_sqm ?? "—"}</dd>
            <dt className="text-muted">{a.listing.seller}</dt>
            <dd>
              <Link href={localePath(lang, `/admin/users/${listing.seller_id}`)} className="font-semibold text-brand hover:underline">
                {seller?.display_name ?? "—"}
              </Link>{" "}
              ({dict.listing[listing.poster_type === "agent" ? "agent" : "owner"]})
            </dd>
            <dt className="text-muted">{a.listing.contactPhone}</dt>
            <dd dir="ltr" className="text-start">
              {contact ? displayPhone(contact.phone) : a.listing.noContact}
            </dd>
            <dt className="text-muted">{a.listing.submitted}</dt>
            <dd>{listing.submitted_at ? formatDate(listing.submitted_at, lang) : "—"}</dd>
            <dt className="text-muted">{a.listing.expiry}</dt>
            <dd>{listing.expires_at ? formatDate(listing.expires_at, lang) : "—"}</dd>
          </dl>
          <p className="mt-3 whitespace-pre-line text-sm" dir="auto">
            {listing.description || dict.listing.noDescription}
          </p>
        </section>

        <section className={box} aria-label={dict.listing.photos}>
          {signed?.length ? (
            <ul className="grid grid-cols-3 gap-2">
              {signed.flatMap((s) => (s.signedUrl ? [s.signedUrl] : [])).map((src) => (
                <li key={src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{dict.photos.none}</p>
          )}
        </section>
      </div>

      <section className={box}>
        <h3 className="mb-2 font-extrabold">{a.listing.reports}</h3>
        {!reports?.length ? (
          <p className="text-sm text-muted">{a.listing.noReports}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0">
                <p className="text-sm">
                  <span className="font-bold">{dict.reportReasons[r.reason as keyof typeof dict.reportReasons] ?? r.reason}</span> ·{" "}
                  {a.reports.statuses[r.status]} · {formatDate(r.created_at, lang)}
                </p>
                {r.details && (
                  <p className="text-sm" dir="auto">
                    {r.details}
                  </p>
                )}
                <ReportControls kind="listing" id={r.id} status={r.status} a={a} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={box}>
        <h3 className="mb-2 font-extrabold">{a.listing.declarations}</h3>
        {!declarations?.length ? (
          <p className="text-sm text-muted">{a.listing.noDeclarations}</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {declarations.map((d) => (
              <li key={d.id}>
                {formatDateTime(d.created_at, lang)} · {a.listing.declarationVersion}: <span dir="ltr">{d.version}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={box}>
        <h3 className="mb-1 font-extrabold">{a.listing.versions}</h3>
        <p className="mb-2 text-xs text-muted">{a.listing.versionsHint}</p>
        <ol className="flex flex-col gap-2 text-sm">
          {versionChanges(versions ?? []).map((v) => (
            <li key={v.id} className="border-b border-border pb-2 last:border-b-0">
              <p>
                <span className="text-muted">{formatDateTime(v.createdAt, lang)}</span> ·{" "}
                <span className="font-bold">{a.listing.versionKinds[v.kind]}</span> ·{" "}
                {v.byAdmin ? a.listing.byAdmin : v.bySeller ? a.listing.bySeller : a.listing.system}
              </p>
              {v.changes.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 ps-4 text-xs">
                  {v.changes.map((c) => (
                    <li key={c.field} dir="auto">
                      <span className="font-semibold">{c.field}</span>: <del className="text-muted">{c.before}</del> → {c.after}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className={box}>
        <h3 className="mb-2 font-extrabold">{a.listing.history}</h3>
        <ol className="flex flex-col gap-1 text-sm">
          {(history ?? []).map((h) => (
            <li key={h.id}>
              <span className="text-muted">{formatDate(h.created_at, lang)}</span> ·{" "}
              {h.from_status ? `${dict.status[h.from_status]} → ` : ""}
              <span className="font-bold">{dict.status[h.to_status]}</span> ·{" "}
              {(h.profiles as { display_name: string } | null)?.display_name ?? a.listing.system}
              {h.reason && (
                <span className="text-muted" dir="auto">
                  {" "}
                  — {h.reason}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
