import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavouriteButton } from "@/components/favourite-button";
import { cardLabels, ListingCard } from "@/components/listing-card";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getMyFavourites } from "@/lib/data/owner";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/favourites">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).favourites.title, robots: { index: false } };
}

export default async function FavouritesPage({ params }: PageProps<"/[lang]/my/favourites">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireUser(lang, "/my/favourites");
  const [dict, items] = await Promise.all([getDictionary(lang), getMyFavourites(user.id)]);
  const labels = cardLabels(dict);
  const loginHref = localePath(lang, "/login");

  return (
    <section aria-labelledby="fav-heading">
      <h1 id="fav-heading" className="mb-4 text-2xl font-extrabold">
        {dict.favourites.title}
      </h1>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">{dict.favourites.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.listingId} className="flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface pb-2">
              {item.listing ? (
                <ListingCard listing={item.listing} locale={lang} labels={labels} />
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">
                  {dict.favourites.unavailable} <span dir="ltr">#{item.listingId}</span>
                </p>
              )}
              <FavouriteButton
                listingId={item.listingId}
                initialSaved
                loginHref={loginHref}
                text={{ add: dict.favourites.add, remove: dict.favourites.remove }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
