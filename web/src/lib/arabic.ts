// Forgiving name search for area lists: people type ه for ة, ا for أ/إ/آ, ي
// for ى, skip vowel marks and "ال", and mix upper and lower case in English.

export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // vowel marks and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/(^|\s)al-/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when every word typed appears somewhere in the name (or the query is empty). */
export function matchesName(name: string, query: string): boolean {
  const words = normalizeForSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const target = normalizeForSearch(name);
  return words.every((w) => target.includes(w));
}
