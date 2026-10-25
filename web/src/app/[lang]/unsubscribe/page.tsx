import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UnsubscribeForm } from "@/components/unsubscribe-form";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/unsubscribe">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).follows.unsubscribeTitle, robots: { index: false } };
}

/**
 * Opened from the link in a "similar listings" e-mail. Unsubscribing needs a
 * click (not just opening the link), so mail scanners that open links don't
 * unsubscribe people by accident. No sign-in needed.
 */
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[lang]/unsubscribe">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Suspense>
        <UnsubscribeForm searchParams={searchParams} text={dict.follows} />
      </Suspense>
    </div>
  );
}
