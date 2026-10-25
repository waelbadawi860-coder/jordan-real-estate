import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormMessage } from "@/components/form-controls";
import { ListingForm } from "@/components/listing-form";
import { hasLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getOwnProfile, requireUser } from "@/lib/auth";
import { requireCurrentConsent } from "@/lib/consent";
import { getReferenceData } from "@/lib/data/public";
import { displayPhone, t } from "@/lib/format";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[lang]/post">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).form.newTitle, robots: { index: false } };
}

export default async function PostPage({ params }: PageProps<"/[lang]/post">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  await requireUser(lang, "/post");
  await requireCurrentConsent(lang, "/post");
  const [dict, ref, profile] = await Promise.all([getDictionary(lang), getReferenceData(), getOwnProfile()]);
  const amman = ref.cities.find((c) => c.slug === "amman");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-extrabold">{dict.form.newTitle}</h1>
      <p className="mb-5 text-sm text-muted">
        {t(dict.promote.postNote, { n: Number(ref.settings.max_active_listings_individual ?? 3) })}{" "}
        <Link href={localePath(lang, "/pricing")} className="font-bold text-brand hover:underline">
          {dict.promote.link}
        </Link>
      </p>
      {profile?.status !== "active" ? (
        <FormMessage kind="error">{dict.account.suspended}</FormMessage>
      ) : (
        <ListingForm
          locale={lang}
          dict={dict}
          refData={ref}
          initial={{
            dealType: "",
            rentPeriod: "",
            propertyTypeId: "",
            cityId: amman ? String(amman.id) : "",
            neighborhoodId: "",
            title: "",
            description: "",
            price: "",
            areaSqm: "",
            bedrooms: "",
            bathrooms: "",
            floorsCount: "",
            floor: "",
            furnished: "",
            posterType: "owner",
            phone: profile.phone ? displayPhone(profile.phone).replace(/\s/g, "") : "",
            allowCalls: true,
            allowWhatsapp: true,
            latitude: "",
            longitude: "",
          }}
        />
      )}
    </div>
  );
}
