import Link from "next/link";
import { localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

// Shown (with a real 404 status, so search engines drop the page) when an ad
// was sold, rented, withdrawn, removed or has expired. Not-found pages receive
// no params, so the message is shown in both languages.
export default async function ListingNotFound() {
  const [ar, en] = await Promise.all([getDictionary("ar"), getDictionary("en")]);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-16 text-center">
      {([
        ["ar", ar],
        ["en", en],
      ] as const).map(([lang, d]) => (
        <section key={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex flex-col items-center gap-2">
          <h1 className={lang === "ar" ? "text-xl font-extrabold" : "text-lg font-bold"}>{d.listing.notFoundTitle}</h1>
          <p className="text-muted">{d.listing.notFoundText}</p>
          <Link href={localePath(lang, "/search")} className="font-bold text-brand underline">
            {d.home.viewAll}
          </Link>
        </section>
      ))}
    </div>
  );
}
