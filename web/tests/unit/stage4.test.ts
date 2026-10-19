import { describe, expect, it, vi } from "vitest";

// These modules import "server-only", which throws outside the Next.js server.
vi.mock("server-only", () => ({}));

const { safeNextPath } = await import("@/lib/auth");
const { detectImageType } = await import("@/lib/photos");
const { canRenewListing } = await import("@/lib/listing-rules");
const { listingSchema, normalizeJordanPhone } = await import("@/lib/validation/listing");
const { registerSchema } = await import("@/lib/validation/auth");

describe("Jordanian phone numbers", () => {
  it("normalizes the common ways people type numbers", () => {
    expect(normalizeJordanPhone("0791234567")).toBe("+962791234567");
    expect(normalizeJordanPhone("079 123 4567")).toBe("+962791234567");
    expect(normalizeJordanPhone("+962 79-123-4567")).toBe("+962791234567");
    expect(normalizeJordanPhone("00962781234567")).toBe("+962781234567");
    expect(normalizeJordanPhone("771234567")).toBe("+962771234567");
    expect(normalizeJordanPhone("065001234")).toBe("+96265001234");
  });

  it("rejects non-Jordanian or malformed numbers", () => {
    expect(normalizeJordanPhone("0761234567")).toBeNull(); // no 076 mobile prefix
    expect(normalizeJordanPhone("+966501234567")).toBeNull();
    expect(normalizeJordanPhone("07912345")).toBeNull();
    expect(normalizeJordanPhone("hello")).toBeNull();
  });
});

const valid = {
  dealType: "rent",
  rentPeriod: "monthly",
  propertyTypeId: "1",
  cityId: "1",
  neighborhoodId: "",
  title: "شقة للإيجار في خلدا",
  description: "",
  price: "650",
  areaSqm: "140",
  bedrooms: "2",
  bathrooms: "",
  floor: "",
  furnished: "yes",
  posterType: "owner",
  phone: "0791234567",
  allowCalls: true,
  allowWhatsapp: true,
};

function errorsOf(input: Record<string, unknown>) {
  const result = listingSchema.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("listing form validation", () => {
  it("accepts a valid listing and keeps the price as an exact decimal string", () => {
    const result = listingSchema.parse({ ...valid, price: "125,000.125" });
    expect(result.price).toBe("125000.125");
    expect(result.phone).toBe("+962791234567");
    expect(result.neighborhoodId).toBeUndefined();
    expect(result.bedrooms).toBe(2);
  });

  it("requires a rent period for rentals", () => {
    expect(errorsOf({ ...valid, rentPeriod: "" })).toMatchObject({ rentPeriod: "required" });
  });

  it("rejects bad prices, titles and numbers", () => {
    expect(errorsOf({ ...valid, price: "0" })).toMatchObject({ price: "invalidPrice" });
    expect(errorsOf({ ...valid, price: "1e5" })).toMatchObject({ price: "invalidPrice" });
    expect(errorsOf({ ...valid, price: "12.3456" })).toMatchObject({ price: "invalidPrice" });
    expect(errorsOf({ ...valid, title: "abc" })).toMatchObject({ title: "titleLength" });
    expect(errorsOf({ ...valid, bedrooms: "two" })).toMatchObject({ bedrooms: "invalidNumber" });
  });

  it("needs at least one contact method, and a mobile number for WhatsApp", () => {
    expect(errorsOf({ ...valid, allowCalls: false, allowWhatsapp: false })).toMatchObject({ allowWhatsapp: "contactMethod" });
    expect(errorsOf({ ...valid, phone: "065001234", allowWhatsapp: true })).toMatchObject({ phone: "invalidPhone" });
    expect(errorsOf({ ...valid, phone: "065001234", allowWhatsapp: false })).toEqual({});
  });
});

describe("registration validation", () => {
  const base = { displayName: "Wael", email: "Someone@Example.com ", password: "abc12345", acceptTerms: "on" };

  it("accepts valid input and normalizes the email", () => {
    expect(registerSchema.parse(base).email).toBe("someone@example.com");
  });

  it("rejects weak passwords, missing consent and short names", () => {
    expect(registerSchema.safeParse({ ...base, password: "12345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "abcdefgh" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: undefined }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, displayName: "W" }).success).toBe(false);
  });
});

describe("safe redirects after login", () => {
  it("allows same-site paths only", () => {
    expect(safeNextPath("/my/listings", "/")).toBe("/my/listings");
    expect(safeNextPath("/en/post", "/")).toBe("/en/post");
    expect(safeNextPath("https://evil.example", "/")).toBe("/");
    expect(safeNextPath("//evil.example", "/")).toBe("/");
    expect(safeNextPath("/\\evil.example", "/")).toBe("/");
    expect(safeNextPath(undefined, "/fallback")).toBe("/fallback");
  });
});

describe("image type detection (before photos become public)", () => {
  it("recognizes real image headers only", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
});

describe("renewal window", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  it("allows renewal when expired or within the last 7 days", () => {
    expect(canRenewListing("expired", null, 7, now)).toBe(true);
    expect(canRenewListing("published", "2026-10-25T12:00:00Z", 7, now)).toBe(true);
    expect(canRenewListing("published", "2026-11-15T12:00:00Z", 7, now)).toBe(false);
    expect(canRenewListing("draft", "2026-10-21T12:00:00Z", 7, now)).toBe(false);
  });
});
