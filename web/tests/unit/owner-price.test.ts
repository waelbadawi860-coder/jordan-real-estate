import { describe, expect, it } from "vitest";
import { pricePerSqm } from "@/lib/format";
import { filtersToQuery, parseSearchParams } from "@/lib/search";

describe("'direct from owner' filter", () => {
  it("is read from and written to the address", () => {
    const { filters } = parseSearchParams({ deal: "sale", own: "1" });
    expect(filters.own).toBe("1");
    expect(filtersToQuery(filters)).toContain("own=1");
  });

  it("ignores any other value", () => {
    const { filters, hadInvalid } = parseSearchParams({ own: "yes" });
    expect(filters.own).toBeUndefined();
    expect(hadInvalid).toBe(true);
  });
});

describe("price per square metre", () => {
  it("divides and rounds to whole dinars", () => {
    expect(pricePerSqm(97500, 150)).toBe(650);
    expect(pricePerSqm("185000.500", "180")).toBe(1028);
  });

  it("keeps two decimals for very cheap land", () => {
    expect(pricePerSqm(5000, 1000)).toBe(5);
    expect(pricePerSqm(4500, 1000)).toBe(4.5);
  });

  it("is empty without an area", () => {
    expect(pricePerSqm(90000, null)).toBeNull();
    expect(pricePerSqm(90000, 0)).toBeNull();
  });
});
