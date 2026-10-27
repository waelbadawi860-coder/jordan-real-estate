import { describe, expect, it } from "vitest";
import { extrasFormValues, extrasOf } from "@/lib/listing-details";
import { listingSchema } from "@/lib/validation/listing";

const base = {
  dealType: "sale",
  propertyTypeId: "1",
  cityId: "1",
  neighborhoodId: "5",
  title: "شقة للبيع في خلدا",
  price: "90000",
  phone: "0791234567",
  allowCalls: true,
  allowWhatsapp: false,
};

describe("extra ad details", () => {
  it("keeps only known tick boxes, in list order, and accepts 'partly furnished'", () => {
    const parsed = listingSchema.parse({
      ...base,
      furnished: "partly",
      buildingAge: "1_5",
      features: ["elevator", "made_up", "central_heating"],
      nearby: ["mosque", "school"],
      frontageM: "",
    });
    expect(parsed.furnished).toBe("partly");
    expect(parsed.buildingAge).toBe("1_5");
    expect(parsed.features).toEqual(["central_heating", "elevator"]);
    expect(parsed.nearby).toEqual(["school", "mosque"]);
    expect(parsed.frontageM).toBeUndefined();
  });

  it("rejects an unknown building age or zoning and a bad frontage", () => {
    expect(listingSchema.safeParse({ ...base, buildingAge: "ancient" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, zoning: "res_z" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, frontageM: "0" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, frontageM: "12.5" }).success).toBe(false);
  });

  it("reads saved details safely, ignoring anything unexpected", () => {
    const x = extrasOf({ furnished: true, building_age: "6_9", features: ["pool", "x", "balcony"], frontage_m: "20", nearby: "school" });
    expect(x.furnished).toBeNull();
    expect(x.buildingAge).toBe("6_9");
    expect(x.features).toEqual(["balcony", "pool"]);
    expect(x.frontageM).toBeNull();
    expect(x.nearby).toEqual([]);
    expect(extrasFormValues(x)).toMatchObject({ buildingAge: "6_9", furnished: "", frontageM: "" });
  });
});
