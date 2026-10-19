import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

function placeholders(obj: object): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const walk = (o: object, prefix: string) => {
    for (const [key, value] of Object.entries(o)) {
      if (typeof value === "object" && value !== null) walk(value, `${prefix}${key}.`);
      else out[`${prefix}${key}`] = (String(value).match(/\{\w+\}/g) ?? []).sort();
    }
  };
  walk(obj, "");
  return out;
}

describe("translations", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });

  it("every text uses the same {placeholders} in both languages", () => {
    expect(placeholders(en)).toEqual(placeholders(ar));
  });

  it("no text is empty", () => {
    const empty = (o: object): boolean =>
      Object.values(o).some((v) => (typeof v === "object" && v !== null ? empty(v) : String(v).trim() === ""));
    expect(empty(ar)).toBe(false);
    expect(empty(en)).toBe(false);
  });
});
