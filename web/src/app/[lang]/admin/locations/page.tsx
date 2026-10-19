import Link from "next/link";
import { notFound } from "next/navigation";
import { NamedRowForm } from "@/components/admin/admin-controls";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminLocationsPage({ params, searchParams }: PageProps<"/[lang]/admin/locations">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/locations");
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const l = dict.admin.locations;

  // Admins also see inactive rows (RLS lets admins read everything).
  const supabase = await createClient();
  const { data: cities } = await supabase.from("cities").select("*").order("sort_order").order("name_en");
  const selected = cities?.find((c) => String(c.id) === sp.city) ?? cities?.find((c) => c.slug === "amman") ?? cities?.[0];
  const { data: hoods } = selected
    ? await supabase.from("neighborhoods").select("*").eq("city_id", selected.id).order("sort_order").order("name_en")
    : { data: [] };

  const box = "flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4";
  const toRow = (r: { id: number; name_ar: string; name_en: string; slug: string; sort_order: number; is_active: boolean }) => ({
    id: r.id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    slug: r.slug,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  });

  return (
    <div className="flex flex-col gap-5">
      <section className={box} aria-labelledby="cities">
        <h2 id="cities" className="text-lg font-extrabold">
          {l.cities}
        </h2>
        {(cities ?? []).map((c) => (
          <div key={c.id} className="flex flex-col gap-1 border-b border-border pb-3">
            <Link href={`${localePath(lang, "/admin/locations")}?city=${c.id}`} className="text-sm font-bold text-brand hover:underline">
              {c.name_ar} / {c.name_en} → {l.neighborhoods}
            </Link>
            <NamedRowForm kind="city" row={toRow(c)} a={dict.admin} />
          </div>
        ))}
        <h3 className="font-bold">{l.addCity}</h3>
        <NamedRowForm kind="city" a={dict.admin} />
      </section>

      {selected && (
        <section className={box} aria-labelledby="hoods">
          <h2 id="hoods" className="text-lg font-extrabold">
            {l.neighborhoods}: {selected.name_ar} / {selected.name_en}
          </h2>
          {(hoods ?? []).map((n) => (
            <div key={n.id} className="border-b border-border pb-3">
              <NamedRowForm kind="neighborhood" row={toRow(n)} cityId={selected.id} a={dict.admin} />
            </div>
          ))}
          <h3 className="font-bold">{l.addNeighborhood}</h3>
          <NamedRowForm kind="neighborhood" cityId={selected.id} a={dict.admin} />
        </section>
      )}
    </div>
  );
}
