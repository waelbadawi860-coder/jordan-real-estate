import { BadgeCheck, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cardLabels, ListingCard, listingListClass } from "@/components/listing-card";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPublicOffice } from "@/lib/data/offices";
import { getReferenceData, getSellerListings } from "@/lib/data/public";

// Only switches off the dev-time instant-navigation check (like the listing
// page). An unknown office shows "not found" with a noindex tag.
export const instant = false;

function parseId(raw: string): number | null {
  return /^[0-9]{1,15}$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/office/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const officeId = parseId(id);
  if (!hasLocale(lang) || officeId === null) return {};
  const office = await getPublicOffice(officeId);
  if (!office) return { robots: { index: false } };
  return { title: office.name, alternates: { canonical: localePath(lang, `/office/${office.id}`) } };
}

export default async function OfficePage({ params }: PageProps<"/[lang]/office/[id]">) {
  const { lang, id } = await params;
  const officeId = parseId(id);
  if (!hasLocale(lang) || officeId === null) notFound();
  const [dict, ref, office] = await Promise.all([getDictionary(lang), getReferenceData(), getPublicOffice(officeId)]);
  if (!office) notFound();
  const listings = await getSellerListings(office.ownerId);
  const labels = cardLabels(dict);
  const city = ref.cities.find((c) => c.id === office.cityId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <header className="mb-4 rounded-2xl border border-border bg-surface p-5">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold" dir="auto">
          {office.name}
          {office.verified && (
            <span className="flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-sm font-bold text-white">
              <BadgeCheck className="size-4" aria-hidden />
              {dict.office.verifiedBadge}
            </span>
          )}
        </h1>
        {city && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4" aria-hidden />
            {city.name[lang]}
          </p>
        )}
        {office.about && (
          <p className="mt-3 whitespace-pre-line text-base" dir="auto">
            {office.about}
          </p>
        )}
        {office.verified && <p className="mt-3 text-xs text-muted">{dict.office.badgeMeaning}</p>}
      </header>

      <h2 className="mb-2 text-base font-extrabold text-muted">{dict.office.listingsTitle}</h2>
      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-muted">{dict.office.noListings}</p>
      ) : (
        <ul className={listingListClass}>
          {listings.map((listing, index) => (
            <li key={listing.id}>
              <ListingCard listing={listing} locale={lang} labels={labels} priority={index < 2} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
