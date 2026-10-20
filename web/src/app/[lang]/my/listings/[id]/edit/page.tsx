import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormMessage } from "@/components/form-controls";
import { ListingForm } from "@/components/listing-form";
import { PhotoManager } from "@/components/photo-manager";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { getMyListing } from "@/lib/data/owner";
import { getReferenceData } from "@/lib/data/public";
import { displayPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/listings/[id]/edit">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).form.editTitle, robots: { index: false } };
}

const EDITABLE = ["draft", "pending_approval", "rejected", "published", "expired"];

export default async function EditListingPage({ params, searchParams }: PageProps<"/[lang]/my/listings/[id]/edit">) {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang) || !/^[0-9]{1,15}$/.test(rawId)) notFound();
  const id = Number(rawId);
  const user = await requireUser(lang, `/my/listings/${id}/edit`);
  const [dict, listing, ref, sp] = await Promise.all([getDictionary(lang), getMyListing(user.id, id), getReferenceData(), searchParams]);
  if (!listing) notFound();
  // The exact pin is private: only the owner (and admins) can read it.
  const supabase = await createClient();
  const { data: location } = await supabase.rpc("get_listing_location", { p_listing_id: id });
  const pin = location?.[0];

  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const editable = EDITABLE.includes(listing.status);
  const photosFirst = sp.step === "photos";

  const photos = (
    <section id="photos" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5" aria-labelledby="s-photos">
      <h2 id="s-photos" className="text-lg font-extrabold">
        {dict.form.sectionPhotos}
      </h2>
      {editable ? (
        <PhotoManager
          listingId={listing.id}
          userId={user.id}
          photos={listing.images.map((i) => ({ id: i.id, url: i.url }))}
          maxPhotos={Number(ref.settings.max_images_per_listing ?? 20)}
          maxDimension={Number(ref.settings.image_max_dimension_px ?? 1600)}
          text={dict.photos}
        />
      ) : (
        <FormMessage kind="info">{dict.form.errors.notEditable}</FormMessage>
      )}
      <Link
        href={localePath(lang, `/my/listings/${listing.id}`)}
        className="flex h-12 w-fit items-center gap-2 rounded-lg bg-brand px-6 font-bold text-white hover:bg-brand-strong"
      >
        {dict.preview.continue}
        <Arrow className="size-5" aria-hidden />
      </Link>
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">
        {dict.form.editTitle} <span className="text-base font-semibold text-muted">· {dict.status[listing.status]}</span>
      </h1>
      {photosFirst && photos}
      {editable ? (
        <ListingForm
          locale={lang}
          dict={dict}
          refData={ref}
          listingId={listing.id}
          warning={listing.status === "published" || listing.status === "expired" ? dict.form.editPublishedWarning : undefined}
          requireDeclaration={listing.status === "published" || listing.status === "expired"}
          initial={{
            dealType: listing.dealType,
            rentPeriod: listing.rentPeriod ?? "",
            propertyTypeId: String(listing.propertyTypeId),
            cityId: String(listing.cityId),
            neighborhoodId: listing.neighborhoodId ? String(listing.neighborhoodId) : "",
            title: listing.title,
            description: listing.description,
            price: listing.price,
            areaSqm: listing.areaSqm ?? "",
            bedrooms: listing.bedrooms?.toString() ?? "",
            bathrooms: listing.bathrooms?.toString() ?? "",
            floor: listing.floor?.toString() ?? "",
            furnished: listing.furnished === null ? "" : listing.furnished ? "yes" : "no",
            posterType: listing.posterType,
            phone: listing.contact ? displayPhone(listing.contact.phone).replace(/\s/g, "") : "",
            allowCalls: listing.contact?.allowCalls ?? true,
            allowWhatsapp: listing.contact?.allowWhatsapp ?? true,
            latitude: pin?.latitude != null ? String(pin.latitude) : "",
            longitude: pin?.longitude != null ? String(pin.longitude) : "",
          }}
        />
      ) : (
        <FormMessage kind="info">{dict.form.errors.notEditable}</FormMessage>
      )}
      {!photosFirst && photos}
    </div>
  );
}
