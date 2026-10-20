/** Production-readiness checks against the running server (`npm run dev`). */
import { describe, expect, it } from "vitest";
import { base } from "./helpers";

describe("operations and security headers", () => {
  it("health check reports the site and database as up", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, db: "up" });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("sends security headers on pages", async () => {
    const res = await fetch(`${base}/`);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("test copies are hidden from search engines", async () => {
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    expect(robots).toMatch(/Disallow: \/\s*$/m);
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
  });
});
