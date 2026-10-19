import { describe, expect, it } from "vitest";
import { settingSchemas } from "@/lib/admin-settings";
import { toCsv } from "@/lib/csv";

describe("CSV export", () => {
  it("starts with a BOM so Excel shows Arabic correctly", () => {
    expect(toCsv(["a"], [["شقة"]]).startsWith("﻿a\r\nشقة")).toBe(true);
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(["x"], [['a,"b"\nc']])).toBe('﻿x\r\n"a,""b""\nc"\r\n');
  });

  it("neutralizes spreadsheet formulas in user-written text", () => {
    const csv = toCsv(["title"], [["=HYPERLINK(\"http://evil\")"], ["+1"], ["-2"], ["@SUM(A1)"]]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1");
    expect(csv).toContain("'-2");
    expect(csv).toContain("'@SUM");
  });

  it("writes empty cells for missing values", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("﻿a,b\r\n,\r\n");
  });
});

describe("admin settings validation", () => {
  it("accepts sensible values and rejects out-of-range ones", () => {
    expect(settingSchemas.listing_expiry_days.parse("45")).toBe(45);
    expect(settingSchemas.listing_expiry_days.safeParse("0").success).toBe(false);
    expect(settingSchemas.listing_expiry_days.safeParse("abc").success).toBe(false);
    expect(settingSchemas.require_listing_approval.parse("false")).toBe(false);
    expect(settingSchemas.require_listing_approval.safeParse("maybe").success).toBe(false);
    expect(settingSchemas.contact_email.parse("")).toBeNull();
    expect(settingSchemas.contact_email.safeParse("not-an-email").success).toBe(false);
    expect(settingSchemas.site_name_ar.safeParse("ع").success).toBe(false);
  });
});
