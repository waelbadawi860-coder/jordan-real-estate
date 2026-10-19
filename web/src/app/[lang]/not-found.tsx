import Link from "next/link";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath } from "@/i18n/config";

// Not-found pages receive no params; the message is shown in both languages.
export default async function NotFound() {
  const [ar, en] = await Promise.all([getDictionary("ar"), getDictionary("en")]);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center">
      <p className="text-6xl font-extrabold text-brand">404</p>
      <div dir="rtl" lang="ar">
        <h1 className="text-xl font-extrabold">{ar.common.notFoundTitle}</h1>
        <p className="text-muted">{ar.common.notFoundText}</p>
        <Link href={localePath("ar", "/")} className="mt-2 inline-block font-bold text-brand underline">
          {ar.common.goHome}
        </Link>
      </div>
      <div dir="ltr" lang="en">
        <h2 className="text-lg font-bold">{en.common.notFoundTitle}</h2>
        <p className="text-muted">{en.common.notFoundText}</p>
        <Link href={localePath("en", "/")} className="mt-2 inline-block font-bold text-brand underline">
          {en.common.goHome}
        </Link>
      </div>
    </div>
  );
}
