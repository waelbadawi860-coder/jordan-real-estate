import { describe, expect, it } from "vitest";
import { matchesName, normalizeForSearch } from "@/lib/arabic";

describe("area name search", () => {
  it("treats common spelling variants as the same", () => {
    expect(normalizeForSearch("البقعه")).toBe(normalizeForSearch("البقعة"));
    expect(normalizeForSearch("ابو نصير")).toBe(normalizeForSearch("أبو نصير"));
    expect(normalizeForSearch("الحرّيّة")).toBe(normalizeForSearch("الحرية"));
    expect(normalizeForSearch("Al-Rabiah")).toBe(normalizeForSearch("rabiah"));
  });

  it("finds an area from part of its name", () => {
    expect(matchesName("عبدون الشمالي", "عبد")).toBe(true);
    expect(matchesName("الصويفية", "صويفيه")).toBe(true);
    expect(matchesName("أم أذينة الشرقي", "ام اذينه")).toBe(true);
    expect(matchesName("North Abdoun", "abdoun north")).toBe(true);
    expect(matchesName("خلدا", "عبد")).toBe(false);
  });

  it("shows everything for an empty search", () => {
    expect(matchesName("خلدا", "")).toBe(true);
    expect(matchesName("خلدا", "  ")).toBe(true);
  });
});
