import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactMessageForm, ReportListingForm } from "@/components/contact-forms";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getListing, getReferenceData } from "@/lib/data/public";
import { t } from "@/lib/format";
import { listingPath } from "@/lib/paths";

// Reads ?listing= from the address, so it renders per request.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).contact.title };
}

export default async function ContactPage({ params, searchParams }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const sp = await searchParams;
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const c = dict.contact;

  const rawListing = Array.isArray(sp.listing) ? sp.listing[0] : sp.listing;
  const listingId = rawListing && /^\d{1,15}$/.test(rawListing) ? Number(rawListing) : null;
  const listing = listingId ? await getListing(listingId) : null;
  const email = typeof ref.settings.contact_email === "string" ? ref.settings.contact_email : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      {listing ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h1 className="mb-1 text-2xl font-extrabold">{t(c.reportTitle, { id: listing.id })}</h1>
          <p className="mb-4 text-sm text-muted">
            <Link href={listingPath(lang, listing.id, listing.title)} className="font-semibold text-brand hover:underline" dir="auto">
              {listing.title}
            </Link>
            <br />
            {c.reportIntro}
          </p>
          <ReportListingForm listingId={listing.id} dict={dict} />
        </section>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold">{c.title}</h1>
          {listingId && <p className="font-semibold text-danger">{c.listingUnavailable}</p>}
        </>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        {listing && <h2 className="mb-2 text-xl font-extrabold">{c.title}</h2>}
        <p className="mb-4 text-muted">{c.intro}</p>
        {email && (
          <p className="mb-4 text-sm">
            {c.ourEmail}:{" "}
            <a href={`mailto:${email}`} className="font-semibold text-brand underline" dir="ltr">
              {email}
            </a>
          </p>
        )}
        <ContactMessageForm dict={dict} />
      </section>
    </div>
  );
}
