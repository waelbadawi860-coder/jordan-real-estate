import { NextResponse, type NextRequest } from "next/server";
import { getAdminActor } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import { getReferenceData } from "@/lib/data/public";
import { createAdminClient } from "@/lib/supabase/admin";

// CSV downloads for administrators. Access is checked here on the server, and
// every export is written to the audit log (who exported what, and when).
const KINDS = ["listings", "users", "reports"] as const;
type Kind = (typeof KINDS)[number];

export async function GET(_request: NextRequest, { params }: RouteContext<"/[lang]/admin/export/[kind]">) {
  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) return new NextResponse("Not found", { status: 404 });

  const actor = await getAdminActor();
  if (!actor) return new NextResponse("Not found", { status: 404 });
  const { supabase, userId } = actor;

  let csv: string;
  let rowCount = 0;

  if (kind === "listings") {
    const ref = await getReferenceData();
    const name = <T extends { id: number; name: { en: string } }>(list: T[], id: number | null) =>
      list.find((x) => x.id === id)?.name.en ?? "";
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, status, deal_type, property_type_id, city_id, neighborhood_id, title, price, currency, area_sqm, bedrooms, bathrooms, poster_type, seller_id, created_at, published_at, expires_at, profiles!listings_seller_id_fkey(display_name)",
      )
      .order("id")
      .limit(50000);
    if (error) return new NextResponse("Export failed", { status: 500 });
    rowCount = data.length;
    csv = toCsv(
      ["id", "status", "deal_type", "property_type", "city", "neighborhood", "title", "price", "currency", "area_sqm", "bedrooms", "bathrooms", "poster_type", "seller_id", "seller_name", "created_at", "published_at", "expires_at"],
      data.map((l) => [
        l.id,
        l.status,
        l.deal_type,
        name(ref.propertyTypes, l.property_type_id),
        name(ref.cities, l.city_id),
        name(ref.neighborhoods, l.neighborhood_id),
        l.title,
        l.price,
        l.currency,
        l.area_sqm,
        l.bedrooms,
        l.bathrooms,
        l.poster_type,
        l.seller_id,
        (l.profiles as { display_name: string } | null)?.display_name,
        l.created_at,
        l.published_at,
        l.expires_at,
      ]),
    );
  } else if (kind === "users") {
    const rows: (string | number | null)[][] = [];
    for (let offset = 0; offset < 20000; offset += 100) {
      const { data, error } = await supabase.rpc("admin_search_users", { p_limit: 100, p_offset: offset });
      if (error) return new NextResponse("Export failed", { status: 500 });
      for (const u of data) {
        rows.push([u.id, u.email, u.display_name, u.phone, u.role, u.status, u.created_at, u.last_sign_in_at, Number(u.listing_count)]);
      }
      if (data.length < 100) break;
    }
    rowCount = rows.length;
    csv = toCsv(["id", "email", "display_name", "phone", "role", "status", "created_at", "last_sign_in_at", "listing_count"], rows);
  } else {
    const [lr, ur] = await Promise.all([
      supabase.from("listing_reports").select("id, listing_id, reason, details, status, reporter_id, created_at, resolved_at, resolution_note").order("id").limit(50000),
      supabase.from("user_reports").select("id, reported_user_id, reason, details, status, reporter_id, created_at, resolved_at, resolution_note").order("id").limit(50000),
    ]);
    if (lr.error || ur.error) return new NextResponse("Export failed", { status: 500 });
    const rows = [
      ...lr.data.map((r) => ["listing", r.id, r.listing_id, r.reason, r.details, r.status, r.reporter_id, r.created_at, r.resolved_at, r.resolution_note]),
      ...ur.data.map((r) => ["user", r.id, r.reported_user_id, r.reason, r.details, r.status, r.reporter_id, r.created_at, r.resolved_at, r.resolution_note]),
    ];
    rowCount = rows.length;
    csv = toCsv(["type", "id", "target", "reason", "details", "status", "reporter_id", "created_at", "resolved_at", "resolution_note"], rows);
  }

  await createAdminClient().rpc("record_admin_action", {
    p_actor: userId,
    p_action: "csv_export",
    p_entity_type: kind,
    p_entity_id: "all",
    p_details: { rows: rowCount },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
