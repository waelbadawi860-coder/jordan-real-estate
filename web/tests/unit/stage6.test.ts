import { describe, expect, it } from "vitest";
import { settingSchemas } from "@/lib/admin-settings";
import { estimateCommission, filsToString, toFils, type CommissionRule } from "@/lib/commission";

const rule = (over: Partial<CommissionRule>): CommissionRule => ({
  id: 1,
  dealType: "sale",
  basis: "sale_price",
  percentage: "2",
  fixedAmount: null,
  minAmount: null,
  maxAmount: null,
  dueDays: 7,
  triggerEvent: "transaction_completed",
  agreementVersionId: 1,
  ...over,
});

describe("exact money arithmetic", () => {
  it("converts JOD to whole fils and back without rounding errors", () => {
    expect(toFils("125,000.5")).toBe(125000500n);
    expect(toFils("0.001")).toBe(1n);
    expect(toFils("1.2345")).toBeNull();
    expect(toFils("-5")).toBeNull();
    expect(filsToString(125000500n)).toBe("125000.5");
    expect(filsToString(1000n)).toBe("1");
    // 0.1 + 0.2 is the classic floating-point trap:
    expect(filsToString(toFils("0.1")! + toFils("0.2")!)).toBe("0.3");
  });
});

describe("commission estimate (mirrors the database)", () => {
  it("applies percentage, rounding, minimum and maximum", () => {
    expect(estimateCommission(rule({}), "200000")).toBe("4000");
    expect(estimateCommission(rule({ percentage: "2.5" }), "12345.678")).toBe("308.642");
    expect(estimateCommission(rule({ minAmount: "100" }), "1000")).toBe("100");
    expect(estimateCommission(rule({ maxAmount: "5000" }), "1000000")).toBe("5000");
    expect(estimateCommission(rule({ basis: "fixed_amount", percentage: null, fixedAmount: "250" }), null)).toBe("250");
  });

  it("rounds half a fils up, like PostgreSQL's round()", () => {
    // 0.025 JOD * 50% = 0.0125 JOD → 0.013
    expect(estimateCommission(rule({ percentage: "50" }), "0.025")).toBe("0.013");
  });

  it("returns nothing for missing or invalid values", () => {
    expect(estimateCommission(rule({}), "")).toBeNull();
    expect(estimateCommission(rule({}), "abc")).toBeNull();
    expect(estimateCommission(rule({}), "0")).toBeNull();
  });
});

describe("payment settings validation", () => {
  it("accepts a Jordanian IBAN with or without spaces", () => {
    expect(settingSchemas.payment_iban.parse("JO94 CBJO 0010 0000 0000 0131 0003 02")).toBe("JO94CBJO0010000000000131000302");
    expect(settingSchemas.payment_iban.parse("")).toBe("");
    expect(settingSchemas.payment_iban.safeParse("GB29NWBK60161331926819").success).toBe(false);
    expect(settingSchemas.payment_iban.safeParse("JO94CBJO001").success).toBe(false);
  });
});
