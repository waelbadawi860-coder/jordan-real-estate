import type { Locale } from "@/i18n/config";

/** Replaces {name} placeholders in a translated string. */
export function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

// Western digits in both languages: this is what most Jordanian property ads use.
const numberLocale: Record<Locale, string> = { ar: "ar-JO-u-nu-latn", en: "en-JO" };

export function formatNumber(value: number | string, locale: Locale): string {
  return new Intl.NumberFormat(numberLocale[locale], { maximumFractionDigits: 3 }).format(Number(value));
}

/** Price in JOD. Prices are stored as exact decimals and arrive as strings or numbers. */
export function formatPrice(value: number | string, locale: Locale, currencyLabel: string): string {
  return `${formatNumber(value, locale)} ${currencyLabel}`;
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(numberLocale[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Amman",
  }).format(new Date(iso));
}

/** Date and time in Amman, e.g. for records and evidence. */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(numberLocale[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Amman",
  }).format(new Date(iso));
}

/** URL-friendly version of a listing title (keeps Arabic letters). */
export function slugify(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "") // Arabic diacritics
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Jordanian number in international format, e.g. "+962791234567". */
const JORDAN_PHONE = /^\+962[0-9]{8,9}$/;

export function isValidJordanPhone(phone: string): boolean {
  return JORDAN_PHONE.test(phone);
}

export function telUrl(phone: string): string {
  if (!isValidJordanPhone(phone)) throw new Error("Invalid phone number");
  return `tel:${phone}`;
}

/** Click-to-chat link with a prefilled message. Opens WhatsApp; it does not send anything. */
export function whatsappUrl(phone: string, message: string): string {
  if (!isValidJordanPhone(phone)) throw new Error("Invalid phone number");
  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}

/** "+962791234567" → "079 123 4567" for display. */
export function displayPhone(phone: string): string {
  if (!isValidJordanPhone(phone)) return phone;
  const local = `0${phone.slice(4)}`;
  return local.length === 10
    ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
    : `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
