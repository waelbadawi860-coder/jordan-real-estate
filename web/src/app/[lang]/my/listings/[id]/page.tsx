import { Phone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcceptAndSubmit } from "@/components/commission/accept-submit";
import { AgreementBox } from "@/components/commission/agreement-box";
import { PropertyView } from "@/components/property-view";
import { StatusActions } from "@/components/status-actions";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOwnProfile, requireUser } from "@/lib/auth";
import { getCommissionTermsFresh, isCommissionEnabled } from "@/lib/data/commission";
import { getMyListing } from "@/lib/data/owner";
import { getReferenceData } from "@/lib/data/public";
import { displayPhone, formatDate, t } from "@/lib/format";
import { canRenewListing } from "@/lib/listing-rules";
import { listingPath } from "@/lib/paths";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/my/listings/[id]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).preview.title, robots: { index: false } };
}

export default async function PreviewListingPage({ params }: PageProps<"/[lang]/my/listings/[id]">) {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang) || !/^[0-9]{1,15}$/.test(rawId)) notFound();
  const id = Number(rawId);
  const user = await requireUser(lang, `/my/listings/${id}`);
  const [dict, listing, ref, profile, terms] = await Promise.all([
    getDictionary(lang),
    getMyListing(user.id, id),
    getReferenceData(),
    getOwnProfile(),
    getCommissionTermsFresh(),
  ]);
  if (!listing) notFound();

  const type = ref.propertyTypes.find((p) => p.id === listing.propertyTypeId);
  const city = ref.cities.find((c) => c.id === listing.cityId);
  const hood = ref.neighborhoods.find((n) => n.id === listing.neighborhoodId);
  const canRenew = canRenewListing(listing.status, listing.expiresAt, Number(ref.settings.renewal_window_days ?? 7));
  const requireApproval = ref.settings.require_listing_approval !== false;

  // Commission agreement: shown before submitting when the system is on.
  const commissionOn = await isCommissionEnabled();
  const agreement = terms.agreement;
  const acceptedCurrent = agreement ? listing.acceptances.find((a) => a.versionId === agreement.id) : undefined;
  const submittable = ["draft", "rejected", "withdrawn"].includes(listing.status);
  const needsAgreement = commissionOn && !acceptedCurrent;
  const rule = terms.rules.find((r) => r.dealType === listing.dealType) ?? null;

  return (
    <div className="-mx-4 -my-6">
      <div className="mx-4 mt-6 flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-4">
        <p className="font-bold">
          {dict.preview.title} · {dict.status[listing.status]}
        </p>
        <p className="text-sm">{dict.preview.note}</p>
        {listing.status === "rejected" && listing.rejectionReason && (
          <p className="text-sm font-semibold text-danger">{t(dict.myListings.rejectionReason, { reason: listing.rejectionReason })}</p>
        )}
        <StatusActions
          locale={lang}
          listingId={listing.id}
          status={listing.status}
          dealType={listing.dealType}
          canRenew={canRenew}
          publicHref={listingPath(lang, listing.id, listing.title)}
          showPreview={false}
          showSubmit
          requireApproval={requireApproval}
          needsAgreement={needsAgreement}
          hasAgreement={listing.acceptances.length > 0}
          dict={dict}
        />
        {acceptedCurrent && <p className="text-sm text-muted">{t(dict.commission.acceptedOn, { date: formatDate(acceptedCurrent.acceptedAt, lang) })}</p>}
      </div>

      {needsAgreement && submittable && agreement && (
        <div className="mx-4 mt-4">
          <AgreementBox agreement={agreement} rule={rule} locale={lang} dict={dict} intro={dict.commission.agreementIntro}>
            {rule ? (
              <AcceptAndSubmit listingId={listing.id} requireApproval={requireApproval} dict={dict} />
            ) : (
              <p className="font-semibold text-danger">{dict.commission.errors.no_active_rule}</p>
            )}
          </AgreementBox>
        </div>
      )}

      <PropertyView
        listing={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          price: Number(listing.price),
          dealType: listing.dealType,
          rentPeriod: listing.rentPeriod,
          type: type?.name ?? { ar: "", en: "" },
          city: city?.name ?? { ar: "", en: "" },
          neighborhood: hood?.name ?? null,
          areaSqm: listing.areaSqm === null ? null : Number(listing.areaSqm),
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          floor: listing.floor,
          furnished: listing.furnished,
          posterType: listing.posterType,
          publishedAt: listing.publishedAt,
          updatedAt: listing.updatedAt,
          images: listing.images.filter((i) => i.url).map((i) => ({ url: i.url!, width: null, height: null })),
          seller: profile ? { displayName: profile.displayName, memberSince: profile.createdAt } : null,
        }}
        locale={lang}
        dict={dict}
        back={{ href: localePath(lang, "/my/listings"), label: dict.myListings.title }}
        contact={
          listing.contact ? (
            <p className="flex items-center justify-center gap-2 rounded-lg bg-brand-soft p-3 text-lg font-extrabold" dir="ltr">
              <Phone className="size-5" aria-hidden />
              {displayPhone(listing.contact.phone)}
            </p>
          ) : (
            <p className="font-semibold text-danger">{dict.preview.needContact}</p>
          )
        }
      />
    </div>
  );
}
