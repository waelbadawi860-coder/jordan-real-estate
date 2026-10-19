import { Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ContactPanel } from "@/components/contact-panel";
import { FavouriteButton } from "@/components/favourite-button";
import { PropertyView } from "@/components/property-view";
import { listingPath } from "@/lib/paths";
import { ShareButton } from "@/components/share-button";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSessionUser } from "@/lib/auth";
import { isFavourite } from "@/lib/data/owner";
import { getListing, getReferenceData, siteName } from "@/lib/data/public";
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

// The listing is looked up BEFORE anything is sent, so a missing, sold or
// expired listing returns a real 404 status and outdated links a real 308
// redirect. Search engines then drop old listings instead of indexing them.
// Lookups are cached for a few minutes, so this stays fast.
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
  const saved = user ? await isFavourite(user.id, listing.id) : false;

  return (
    <PropertyView
      listing={listing}
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
  );
}
