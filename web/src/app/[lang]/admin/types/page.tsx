import { notFound } from "next/navigation";
import { NamedRowForm } from "@/components/admin/admin-controls";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdminPage } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminTypesPage({ params }: PageProps<"/[lang]/admin/types">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireAdminPage(lang, "/admin/types");
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data: types } = await supabase.from("property_types").select("*").order("sort_order");

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4" aria-labelledby="types">
      <h2 id="types" className="text-lg font-extrabold">
        {dict.admin.nav.types}
      </h2>
      {(types ?? []).map((t) => (
        <div key={t.id} className="border-b border-border pb-3">
          <NamedRowForm
            kind="type"
            row={{
              id: t.id,
              nameAr: t.name_ar,
              nameEn: t.name_en,
              slug: t.slug,
              sortOrder: t.sort_order,
              isActive: t.is_active,
              hasBedrooms: t.has_bedrooms,
              hasBathrooms: t.has_bathrooms,
              hasFloor: t.has_floor,
              hasFurnished: t.has_furnished,
              hasFloorsCount: t.has_floors_count,
              allowedDeals: t.allowed_deals,
            }}
            a={dict.admin}
          />
        </div>
      ))}
      <h3 className="font-bold">{dict.admin.types.add}</h3>
      <NamedRowForm kind="type" a={dict.admin} />
    </section>
  );
}
