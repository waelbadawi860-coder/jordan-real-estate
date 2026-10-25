import { Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ContactPanel } from "@/components/contact-panel";
import { FavouriteButton } from "@/components/favourite-button";
import { JsonLd } from "@/components/json-ld";
import { PropertyView } from "@/components/property-view";
import { listingPath } from "@/lib/paths";
import { ShareButton } from "@/components/share-button";
import { FollowSimilar } from "@/components/follow-similar";
import { SimilarListings } from "@/components/similar-listings";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSessionUser } from "@/lib/auth";
import { getFollowId, isFavourite } from "@/lib/data/owner";
import { getListing, getReferenceData, getSimilarListings, siteName } from "@/lib/data/public";
import { publicEnv } from "@/lib/env";
import { formatPrice, slugify, t } from "@/lib/format";

type Props = PageProps<"/[lang]/property/[id]/[[...slug]]">;

function parseId(raw: string): number | null {
  return /^[0-9]{1,15}$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id: rawId } = await params;
  const id = parseId(rawId);
  if (!hasLocale(lang) || id === null) return {};

  const [dict, listing, ref] = await Promise.all([getDictionary(lang), getListing(id), getReferenceData()]);
  if (!listing) return { title: dict.listing.notFoundTitle, robots: { index: false } };

  const deal = listing.dealType === "sale" ? dict.search.sale : dict.search.rent;
  const where = [listing.neighborhood?.[lang], listing.city[lang]].filter(Boolean).join(lang === "ar" ? "، " : ", ");
  const price = formatPrice(listing.price, lang, dict.common.currency);
  const description = `${listing.type[lang]} ${deal} — ${where} — ${price}`;
  const path = listingPath(lang, listing.id, listing.title);
  const image = listing.images[0];

  return {
    title: `${listing.title} — ${price}`,
    description,
    alternates: {
      canonical: path,
      languages: { ar: listingPath("ar", listing.id, listing.title), en: listingPath("en", listing.id, listing.title) },
    },
    openGraph: {
      type: "article",
      url: path,
      siteName: siteName(ref, lang),
      title: `${listing.title} — ${price}`,
      description,
      images: image ? [{ url: image.url, width: image.width ?? undefined, height: image.height ?? undefined }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}

// With cacheComponents the header/footer shell is sent first (status 200), so
// a missing, sold or expired listing shows "not found" with a noindex tag
// rather than a 404 status, and outdated links redirect in the browser (the
// canonical tag points to the correct address). Search engines handle both.
// `instant = false` only switches off the dev-time instant-navigation check.
export const instant = false;

export default async function PropertyPage({ params }: Props) {
  const { lang, id: rawId, slug } = await params;
  const id = parseId(rawId);
  if (!hasLocale(lang) || id === null) notFound();

  const [dict, listing, ref] = await Promise.all([getDictionary(lang), getListing(id), getReferenceData()]);
  if (!listing) notFound();

  // One address per listing: fix outdated or missing title slugs.
  const expectedSlug = slugify(listing.title);
  const givenSlug = slug?.[0] ? decodeURIComponent(slug[0]) : "";
  if (expectedSlug && givenSlug !== expectedSlug) permanentRedirect(listingPath(lang, listing.id, listing.title));

  const site = siteName(ref, lang);
  // Short form (no title) so the link survives copy/paste in any messaging app.
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}${localePath(lang, `/property/${listing.id}`)}`;

  const d = dict.listing;
  const user = await getSessionUser();
  const similarOf = { id: listing.id, dealType: listing.dealType, typeId: listing.typeId, cityId: listing.cityId, neighborhoodId: listing.neighborhoodId };
  const [saved, followId, similar] = await Promise.all([
    user ? isFavourite(user.id, listing.id) : false,
    user ? getFollowId(user.id, similarOf) : null,
    getSimilarListings(similarOf),
  ]);

  const canonical = `${publicEnv.NEXT_PUBLIC_SITE_URL}${listingPath(lang, listing.id, listing.title)}`;
  const structured = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description.slice(0, 500) || undefined,
    url: canonical,
    datePosted: listing.publishedAt || undefined,
    image: listing.images.slice(0, 5).map((i) => i.url),
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "JOD",
      businessFunction: listing.dealType === "sale" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut",
      availability: "https://schema.org/InStock",
    },
    about: {
      "@type": "Accommodation",
      name: listing.type[lang],
      floorSize: listing.areaSqm !== null ? { "@type": "QuantitativeValue", value: listing.areaSqm, unitCode: "MTK" } : undefined,
      numberOfBedrooms: listing.bedrooms ?? undefined,
      numberOfBathroomsTotal: listing.bathrooms ?? undefined,
      address: {
        "@type": "PostalAddress",
        addressLocality: listing.neighborhood?.[lang] ?? listing.city[lang],
        addressRegion: listing.city[lang],
        addressCountry: "JO",
      },
    },
  };

  return (
    <>
    <JsonLd data={structured} />
    <PropertyView
      listing={{
        ...listing,
        approxLocation: listing.latitude !== null && listing.longitude !== null ? { lat: listing.latitude, lng: listing.longitude } : null,
      }}
      locale={lang}
      dict={dict}
      back={{ href: localePath(lang, "/search"), label: d.backToResults }}
      contact={
        <ContactPanel
          listingId={listing.id}
          whatsappMessage={t(d.whatsappMessage, { site, url })}
          text={{
            showNumber: d.showNumber,
            call: d.call,
            whatsapp: d.whatsapp,
            contactLimited: d.contactLimited,
            contactUnavailable: d.contactUnavailable,
            contactError: d.contactError,
            loading: dict.search.loading,
          }}
        />
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <FavouriteButton
            listingId={listing.id}
            initialSaved={saved}
            loginHref={`${localePath(lang, "/login")}?next=${encodeURIComponent(listingPath(lang, listing.id, listing.title))}`}
            text={{ add: dict.favourites.add, remove: dict.favourites.remove }}
          />
          <ShareButton title={listing.title} label={d.share} copiedLabel={d.linkCopied} />
          <Link
            href={`${localePath(lang, "/contact")}?listing=${listing.id}`}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-danger"
          >
            <Flag className="size-4" aria-hidden />
            {d.report}
          </Link>
        </div>
      }
    />
    <SimilarListings
      listings={similar}
      locale={lang}
      title={d.similarTitle}
      currency={dict.common.currency}
      perMonth={d.perMonth}
      noPhoto={d.noPhoto}
      action={
        <FollowSimilar
          listingId={listing.id}
          initialId={followId}
          signedIn={Boolean(user)}
          loginHref={`${localePath(lang, "/login")}?next=${encodeURIComponent(listingPath(lang, listing.id, listing.title))}`}
          text={{
            follow: d.followSimilar,
            following: d.followingSimilar,
            unfollow: d.unfollowSimilar,
            limit: d.followLimit,
            error: d.followError,
            hint: d.followHint,
          }}
        />
      }
    />
    </>
  );
}
