import { describe, expect, it } from "vitest";
import { googleMapsUrl, inJordan, isShortMapLink, parseLocation } from "@/lib/geo";

describe("location from a pasted link or coordinates", () => {
  it("reads plain coordinates", () => {
    expect(parseLocation("31.9539, 35.9106")).toEqual({ lat: 31.9539, lng: 35.9106 });
    expect(parseLocation("31.9539 35.9106")).toEqual({ lat: 31.9539, lng: 35.9106 });
    expect(parseLocation("31.9539، 35.9106")).toEqual({ lat: 31.9539, lng: 35.9106 });
  });

  it("reads Google Maps links", () => {
    expect(parseLocation("https://www.google.com/maps/@31.9539,35.9106,15z")).toEqual({ lat: 31.9539, lng: 35.9106 });
    expect(parseLocation("https://maps.google.com/?q=31.95,35.91")).toEqual({ lat: 31.95, lng: 35.91 });
    expect(parseLocation("https://www.google.com/maps/search/?api=1&query=31.95,35.91")).toEqual({ lat: 31.95, lng: 35.91 });
    expect(
      parseLocation("https://www.google.com/maps/place/Abdoun/@31.94,35.88,14z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d31.9455!4d35.8851"),
    ).toEqual({ lat: 31.9455, lng: 35.8851 });
  });

  it("finds nothing in text without a position", () => {
    expect(parseLocation("عبدون قرب الدوار الخامس")).toBeNull();
    expect(parseLocation("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(parseLocation("")).toBeNull();
  });

  it("knows short links, Jordan's borders and builds a map link", () => {
    expect(isShortMapLink("https://maps.app.goo.gl/AbCdEf123")).toBe(true);
    expect(isShortMapLink("https://evil.example/maps")).toBe(false);
    expect(inJordan({ lat: 31.95, lng: 35.91 })).toBe(true);
    expect(inJordan({ lat: 24.7, lng: 46.7 })).toBe(false);
    expect(googleMapsUrl({ lat: 31.95, lng: 35.91 })).toBe("https://www.google.com/maps/search/?api=1&query=31.95,35.91");
  });
});
