import { localePath, type Locale } from "@/i18n/config";
import { slugify } from "@/lib/format";

/**
 * Public, SEO-friendly address of a listing, e.g. /property/100001/شقة-للبيع-في-عبدون
 * The Arabic part is percent-encoded (as HTTP headers and sitemaps require);
 * browsers still display it in Arabic.
 */
export function listingPath(locale: Locale, id: number, title: string): string {
  const slug = slugify(title);
  return localePath(locale, slug ? `/property/${id}/${encodeURIComponent(slug)}` : `/property/${id}`);
}
