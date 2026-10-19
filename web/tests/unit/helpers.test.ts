import { describe, expect, it } from "vitest";
import { dirOf, hasLocale, localePath, stripLocale } from "@/i18n/config";
import { displayPhone, formatPrice, isValidJordanPhone, slugify, t, telUrl, whatsappUrl } from "@/lib/format";
import { listingPath } from "@/lib/paths";
import { filtersToQuery, parseSearchParams, sanitizeFilters } from "@/lib/search";

describe("language routing", () => {
  it("serves Arabic at the root and English under /en", () => {
    expect(localePath("ar", "/search")).toBe("/search");
    expect(localePath("en", "/search")).toBe("/en/search");
    expect(localePath("ar", "/")).toBe("/");
    expect(localePath("en", "/")).toBe("/en");
  });

  it("strips a language prefix from browser paths", () => {
    expect(stripLocale("/en/search")).toBe("/search");
    expect(stripLocale("/ar")).toBe("/");
    expect(stripLocale("/search")).toBe("/search");
    expect(stripLocale("/english-page")).toBe("/english-page");
  });

  it("uses right-to-left only for Arabic and rejects unknown languages", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
    expect(hasLocale("fr")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats JOD prices with Western digits in both languages", () => {
    expect(formatPrice(125000.5, "ar", "د.أ")).toBe("125,000.5 د.أ");
    expect(formatPrice("650", "en", "JOD")).toBe("650 JOD");
    expect(formatPrice(1.125, "en", "JOD")).toBe("1.125 JOD");
  });

  it("fills placeholders in translations", () => {
    expect(t("{n} م²", { n: 180 })).toBe("180 م²");
    expect(t("Hello {missing}", {})).toBe("Hello {missing}");
  });

  it("makes URL slugs that keep Arabic letters and drop punctuation", () => {
    expect(slugify("[تجريبي] شقة طابق ثالث!")).toBe("تجريبي-شقة-طابق-ثالث");
    expect(slugify("Villa in Dabouq, 5 BR")).toBe("villa-in-dabouq-5-br");
    expect(slugify("شَقَّة")).toBe("شقة"); // diacritics removed
    expect(slugify("!!!")).toBe("");
  });

  it("builds percent-encoded listing addresses", () => {
    expect(listingPath("en", 100001, "Villa in Dabouq")).toBe("/en/property/100001/villa-in-dabouq");
    expect(listingPath("ar", 5, "شقة")).toBe(`/property/5/${encodeURIComponent("شقة")}`);
    expect(listingPath("ar", 5, "!!!")).toBe("/property/5");
  });
});

describe("phone numbers and contact links", () => {
  it("accepts only Jordanian numbers in international format", () => {
    expect(isValidJordanPhone("+962791234567")).toBe(true);
    expect(isValidJordanPhone("+96265001234")).toBe(true);
    expect(isValidJordanPhone("0791234567")).toBe(false);
    expect(isValidJordanPhone("+966501234567")).toBe(false);
    expect(isValidJordanPhone("+962791234567; drop table")).toBe(false);
  });

  it("builds a WhatsApp click-to-chat link with the prefilled Arabic message", () => {
    const message = "مرحباً، أود الاستفسار عن العقار المعروض على موقع عقار: https://example.com/property/1";
    const url = new URL(whatsappUrl("+962791234567", message));
    expect(url.origin + url.pathname).toBe("https://wa.me/962791234567");
    expect(url.searchParams.get("text")).toBe(message);
  });

  it("refuses to build links for invalid numbers", () => {
    expect(() => whatsappUrl("12345", "hi")).toThrow();
    expect(() => telUrl("javascript:alert(1)")).toThrow();
  });

  it("shows numbers in the familiar local format", () => {
    expect(displayPhone("+962791234567")).toBe("079 123 4567");
    expect(displayPhone("+96265001234")).toBe("06 500 1234");
  });
});

describe("search filters", () => {
  it("keeps valid filters and drops invalid ones individually", () => {
    const { filters, hadInvalid } = parseSearchParams({
      deal: "rent",
      city: "amman",
      min: "abc",
      max: "900",
      beds: "99",
      sort: "price_asc",
      evil: "1",
    });
    expect(filters).toEqual({ deal: "rent", city: "amman", max: 900, sort: "price_asc" });
    expect(hadInvalid).toBe(true);
  });

  it("rejects slugs that could be used for injection", () => {
    const { filters } = parseSearchParams({ hood: "abdoun,id.gt.0", type: "../x" });
    expect(filters.hood).toBeUndefined();
    expect(filters.type).toBeUndefined();
  });

  it("re-validates filters sent back from the browser", () => {
    expect(sanitizeFilters({ deal: "sale", min: -5, q: "x".repeat(100) })).toEqual({ deal: "sale", sort: "newest" });
    expect(sanitizeFilters("nonsense")).toEqual({ sort: "newest" });
  });

  it("builds shareable query strings without defaults", () => {
    expect(filtersToQuery({ deal: "rent", city: "amman", sort: "newest" })).toBe("?deal=rent&city=amman");
    expect(filtersToQuery({ sort: "newest" })).toBe("");
  });
});
