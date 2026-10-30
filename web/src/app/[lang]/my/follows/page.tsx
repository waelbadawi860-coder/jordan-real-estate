import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnfollowButton } from "@/components/unfollow-button";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getReferenceData } from "@/lib/data/public";
import { formatDate, formatPrice, t } from "@/lib/format";
import { filtersToQuery } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/follows">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).follows.title, robots: { index: false } };
}

/** The user's "similar listings" follows, with a button to stop each one. */
export default async function FollowsPage({ params }: PageProps<"/[lang]/my/follows">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireUser(lang, "/my/follows");
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const f = dict.follows;
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("saved_searches")
    .select("id, deal_type, property_type_id, city_id, neighborhood_id, max_price, owner_only, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <section aria-labelledby="follows-heading">
      <h1 id="follows-heading" className="mb-1 text-2xl font-extrabold">
        {f.title}
      </h1>
      <p className="mb-4 text-sm text-muted">{f.intro}</p>
      {!rows?.length ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">{f.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const type = ref.propertyTypes.find((t) => t.id === r.property_type_id);
            const city = ref.cities.find((c) => c.id === r.city_id);
            const hood = ref.neighborhoods.find((n) => n.id === r.neighborhood_id);
            const deal = r.deal_type === "sale" ? dict.search.sale : r.deal_type === "rent" ? dict.search.rent : "";
            const label = [
              type?.name[lang],
              deal,
              hood?.name[lang],
              city?.name[lang],
              r.max_price !== null && t(f.maxPrice, { price: formatPrice(r.max_price, lang, dict.common.currency) }),
              r.owner_only && dict.search.ownerChip,
            ]
              .filter(Boolean)
              .join(" · ");
            const query = filtersToQuery({
              sort: "newest",
              deal: r.deal_type ?? "all",
              type: type?.slug ?? "all",
              city: city?.slug,
              hood: hood?.slug,
              max: r.max_price ?? undefined,
              own: r.owner_only ? "1" : undefined,
            });
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
                <div>
                  <Link href={`${localePath(lang, "/search")}${query}`} className="font-bold hover:text-brand hover:underline">
                    {label}
                  </Link>
                  <p className="text-xs text-muted">{formatDate(r.created_at, lang)}</p>
                </div>
                <UnfollowButton id={r.id} label={f.stop} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
