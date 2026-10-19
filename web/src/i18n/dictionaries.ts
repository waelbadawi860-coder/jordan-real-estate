import "server-only";
import type { Locale } from "./config";
import type ar from "../../messages/ar.json";

export type Dictionary = typeof ar;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ar: () => import("../../messages/ar.json").then((m) => m.default),
  en: () => import("../../messages/en.json").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
