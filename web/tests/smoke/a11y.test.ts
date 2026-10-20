/**
 * Automated accessibility checks (axe-core) on the main pages, against the
 * running development server (`npm run dev`).
 *
 * jsdom has no real layout engine, so colour contrast is NOT checked here
 * (that needs a real browser); everything structural is: labels, alt text,
 * headings, landmarks, ARIA, link names, language attributes, duplicate IDs…
 */
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { base, createTestSession, deleteTestSession, type TestSession } from "./helpers";

let user: TestSession;
let admin: TestSession;

beforeAll(async () => {
  [user, admin] = await Promise.all([createTestSession("a11y"), createTestSession("a11yadmin", "admin")]);
}, 60_000);

afterAll(async () => {
  await Promise.all([deleteTestSession(user), deleteTestSession(admin)]);
});

async function audit(path: string, session?: TestSession) {
  const res = await fetch(`${base}${path}`, { headers: session ? { cookie: session.cookie } : {} });
  expect(res.status, path).toBe(200);
  const dom = new JSDOM(await res.text(), { url: `${base}${path}`, runScripts: "outside-only", pretendToBeVisual: true });
  dom.window.eval(axe.source);
  const runner = (dom.window as unknown as { axe: typeof axe }).axe;
  const result = await runner.run(dom.window.document, {
    rules: { "color-contrast": { enabled: false } },
    resultTypes: ["violations"],
  });
  dom.window.close();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

describe("accessibility (serious and critical issues)", () => {
  const publicPages = ["/", "/en", "/search?deal=rent", "/property/100017", "/login", "/register", "/forgot-password", "/contact", "/commission-policy", "/terms", "/privacy", "/posting-policy", "/en/reporting-policy"];
  for (const path of publicPages) {
    it(`public page ${path}`, async () => {
      expect(await audit(path)).toEqual([]);
    });
  }

  for (const path of ["/my/listings", "/post", "/my/account", "/my/notifications", "/my/favourites", "/my/security"]) {
    it(`signed-in page ${path}`, async () => {
      expect(await audit(path, user)).toEqual([]);
    });
  }

  for (const path of ["/admin", "/admin/listings", "/admin/settings", "/admin/commissions"]) {
    it(`admin page ${path}`, async () => {
      expect(await audit(path, admin)).toEqual([]);
    });
  }
});
