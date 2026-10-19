export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Public URL path for a page in a given language.
 * Arabic lives at the root ("/search"); English under "/en" ("/en/search").
 */
export function localePath(locale: Locale, path: string = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Removes a leading "/ar" or "/en" from a browser path. */
export function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/(ar|en)(?=\/|$)/);
  const rest = match ? pathname.slice(match[0].length) : pathname;
  return rest === "" ? "/" : rest;
}
