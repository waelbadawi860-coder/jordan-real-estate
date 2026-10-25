import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { dirOf, hasLocale, localePath, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getReferenceData, siteName } from "@/lib/data/public";
import { isLiveSite, publicEnv } from "@/lib/env";
import "../globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: "#1d6b5d",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const name = siteName(ref, lang);
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: `${name} — ${dict.meta.tagline}`, template: `%s | ${name}` },
    description: dict.meta.description,
    applicationName: name,
    // Test copies are never indexed (pages may still set their own rules on the live site).
    ...(isLiveSite ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      siteName: name,
      locale: lang === "ar" ? "ar_JO" : "en_JO",
      type: "website",
    },
    alternates: {
      canonical: localePath(lang, "/"),
      languages: { ar: localePath("ar", "/"), en: localePath("en", "/"), "x-default": "/" },
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [dict, ref] = await Promise.all([getDictionary(lang), getReferenceData()]);
  const name = siteName(ref, lang);

  return (
    <html lang={lang} dir={dirOf(lang)} className={`${cairo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
        >
          {dict.nav.skipToContent}
        </a>
        <SiteHeader locale={lang} dict={dict} siteName={name} />
        {/* The header and footer are sent first and the page streams in after.
            Reserving a full screen keeps the footer out of view until then,
            so it does not jump down (layout shift). */}
        <main id="main" className="min-h-svh flex-1">
          {children}
        </main>
        <SiteFooter locale={lang} dict={dict} siteName={name} />
      </body>
    </html>
  );
}
