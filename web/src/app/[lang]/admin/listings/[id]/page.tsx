import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingModeration, PromotionControls, RecheckRiskButton, ReportControls } from "@/components/admin/admin-controls";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { getReferenceData } from "@/lib/data/public";
import { displayPhone, formatDate, formatDateTime, formatPrice, t } from "@/lib/format";
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
  const [{ data: listing }, { data: history }, { data: reports }, { data: versions }, { data: declarations }, { data: risk }, { data: promotions }] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, status, price, deal_type, property_type_id, city_id, neighborhood_id, area_sqm, description, poster_type, seller_id, submitted_at, expires_at, featured_until, bumped_at, profiles!listings_seller_id_fkey(display_name, status), listing_contacts(phone, allow_calls, allow_whatsapp), listing_images(id, storage_path, position)",
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
    supabase
      .from("listing_promotions")
      .select("id, kind, days, featured_until, amount, payment_ref, note, created_at")
      .eq("listing_id", id)
      .order("id", { ascending: false })
      .limit(50),
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
  const fold = "rounded-2xl border border-border bg-surface";
  const foldTitle = "cursor-pointer p-4 font-extrabold";
  const photos = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
  const flags = risk?.flags ?? [];
  const openReports = (reports ?? []).filter((r) => r.status === "open" || r.status === "reviewing");
  const closedReports = (reports ?? []).filter((r) => !openReports.includes(r));
  const lastDeclaration = declarations?.[0];

  // Order for the reviewer: what to do, warnings (only if any), the photos
  // large, the text, then the decision. Promotion and records stay folded.
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

      {listing.status === "pending_approval" && (
        <section className="rounded-2xl border border-brand/30 bg-brand-soft p-4" aria-labelledby="steps-heading">
          <h3 id="steps-heading" className="font-extrabold">
            {a.review.stepsTitle}
          </h3>
          <ol className="mt-1 list-inside list-decimal text-sm font-semibold">
            {a.review.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a href="#decision" className="mt-2 inline-block text-sm font-bold text-brand hover:underline">
            {a.review.goToDecision}
          </a>
        </section>
      )}

      {flags.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-surface p-4" aria-labelledby="risk-heading">
          <h3 id="risk-heading" className="font-extrabold">
            {a.risk.title}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {flags.map((flag) => (
              <li key={flag} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
                {a.risk.flags[flag as keyof typeof a.risk.flags] ?? flag}
              </li>
            ))}
          </ul>
          <p className="text-sm">{a.risk.hint}</p>
        </section>
      )}

      {openReports.length > 0 && (
        <section className={box}>
          <h3 className="mb-2 font-extrabold">{a.listing.reports}</h3>
          <ul className="flex flex-col gap-3">
            {openReports.map((r) => (
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
        </section>
      )}

      <section className={box} aria-labelledby="photos-heading">
        <h3 id="photos-heading" className="mb-3 font-extrabold">
          {dict.listing.photos} ({photos.length})
        </h3>
        {photos.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {photos.map((src, i) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" loading={i < 2 ? "eager" : "lazy"} />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-accent">{dict.photos.none}</p>
        )}
      </section>

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

      <div id="decision" className="scroll-mt-20">
        <ListingModeration listingId={listing.id} status={listing.status} a={a} />
      </div>

      <details className={fold}>
        <summary className={foldTitle}>{a.promotion.title}</summary>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-sm">
            {listing.featured_until && new Date(listing.featured_until) > new Date()
              ? `${a.promotion.featuredUntil}: ${formatDateTime(listing.featured_until, lang)}`
              : a.promotion.notFeatured}
            {listing.bumped_at && ` · ${a.promotion.lastBump}: ${formatDateTime(listing.bumped_at, lang)}`}
          </p>
          <PromotionControls listingId={listing.id} published={listing.status === "published"} a={a} />
          {promotions && promotions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted">
                  <tr className="text-start">
                    <th className="p-1 text-start">{a.promotion.when}</th>
                    <th className="p-1 text-start">{a.promotion.what}</th>
                    <th className="p-1 text-start">{a.promotion.amount}</th>
                    <th className="p-1 text-start">{a.promotion.paymentRef}</th>
                    <th className="p-1 text-start">{a.promotion.note}</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-1">{formatDateTime(row.created_at, lang)}</td>
                      <td className="p-1">
                        {a.promotion.kinds[row.kind as keyof typeof a.promotion.kinds] ?? row.kind}
                        {row.days ? ` (${row.days})` : ""}
                      </td>
                      <td className="p-1">{row.amount === null ? "—" : formatPrice(Number(row.amount), lang, dict.common.currency)}</td>
                      <td className="p-1" dir="auto">
                        {row.payment_ref ?? "—"}
                      </td>
                      <td className="p-1" dir="auto">
                        {row.note ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      <details className={fold}>
        <summary className={foldTitle}>{a.listing.records}</summary>
        <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
          <div>
            <h4 className="mb-1 font-bold">{a.listing.declarations}</h4>
            <p>
              {lastDeclaration
                ? `${t(a.listing.declarationsCount, { n: declarations!.length })} · ${formatDateTime(lastDeclaration.created_at, lang)}`
                : a.listing.noDeclarations}
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-bold">{a.listing.history}</h4>
            <ol className="flex flex-col gap-1">
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
          </div>

          <div>
            <h4 className="mb-1 font-bold">{a.listing.versions}</h4>
            <p className="mb-2 text-xs text-muted">{a.listing.versionsHint}</p>
            <ol className="flex flex-col gap-2">
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
          </div>

          {closedReports.length > 0 && (
            <div>
              <h4 className="mb-1 font-bold">{a.listing.closedReports}</h4>
              <ul className="flex flex-col gap-1">
                {closedReports.map((r) => (
                  <li key={r.id}>
                    {dict.reportReasons[r.reason as keyof typeof dict.reportReasons] ?? r.reason} · {a.reports.statuses[r.status]} ·{" "}
                    {formatDate(r.created_at, lang)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col items-start gap-1">
            <h4 className="font-bold">{a.risk.title}</h4>
            <p className="text-xs text-muted">
              {risk ? `${a.risk.checkedAt}: ${formatDateTime(risk.checked_at, lang)}` : a.risk.notChecked}
              {risk && flags.length === 0 && ` · ${a.risk.none}`}
            </p>
            <RecheckRiskButton listingId={listing.id} a={a} />
          </div>
        </div>
      </details>
    </div>
  );
}
