import type { Locale } from "@/i18n/config";
import { legalAr } from "./legal-ar";
import { legalEn } from "./legal-en";

export type LegalSlug = "terms" | "privacy" | "posting-policy" | "reporting-policy";
export type LegalSection = { h: string; p?: string[]; list?: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };
export type LegalDocs = Record<LegalSlug, LegalDoc>;

/** Date the current wording was last changed (shown on the page). */
export const LEGAL_UPDATED = "2026-10-25";

/** Which site setting holds each document's version (the posting and reporting policies are part of the terms). */
export const LEGAL_VERSION_SETTING: Record<LegalSlug, "terms_version" | "privacy_version"> = {
  terms: "terms_version",
  privacy: "privacy_version",
  "posting-policy": "terms_version",
  "reporting-policy": "terms_version",
};

export function legalDoc(locale: Locale, slug: LegalSlug): LegalDoc {
  return (locale === "ar" ? legalAr : legalEn)[slug];
}
