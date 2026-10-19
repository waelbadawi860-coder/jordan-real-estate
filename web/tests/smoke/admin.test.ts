/**
 * Smoke test for the admin dashboard and contact page (needs `npm run dev`).
 * Run with: npm run test:smoke
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestSession, deleteTestSession, get, service, type TestSession } from "./helpers";

let admin: TestSession;
let user: TestSession;
let demoListingId: number;

beforeAll(async () => {
  [admin, user] = await Promise.all([createTestSession("admin", "admin"), createTestSession("user")]);
  const { data } = await service.from("listings").select("id").eq("status", "published").limit(1).single();
  demoListingId = data!.id;
}, 60_000);

afterAll(async () => {
  await Promise.all([deleteTestSession(admin), deleteTestSession(user)]);
});

const pages = [
  "/admin",
  "/admin/listings",
  "/admin/listings?status=pending_approval",
  "/admin/users",
  "/admin/reports",
  "/admin/settings",
  "/admin/locations",
  "/admin/types",
  "/admin/audit",
  "/admin/export",
  "/en/admin",
];

describe("admin dashboard access", () => {
  it("is hidden (404) from ordinary users", async () => {
    for (const path of ["/admin", "/admin/users", "/admin/export/users"]) {
      expect((await get(path, user)).status, path).toBe(404);
    }
  });

  it("sends visitors without a session to login, and hides exports", async () => {
    const res = await get("/admin");
    expect([303, 307, 308]).toContain(res.status);
    expect((await get("/admin/export/users")).status).toBe(404);
  });

  it("loads every admin page for an administrator", async () => {
    for (const path of pages) {
      expect((await get(path, admin)).status, path).toBe(200);
    }
    expect((await get(`/admin/listings/${demoListingId}`, admin)).status).toBe(200);
    expect((await get(`/admin/users/${user.userId}`, admin)).status).toBe(200);
  });

  it("finds a user by email in the user search", async () => {
    const res = await get(`/admin/users?q=${encodeURIComponent(user.email)}`, admin);
    expect(await res.text()).toContain(user.email);
  });

  it("exports CSV files and records each export in the audit log", async () => {
    for (const kind of ["listings", "users", "reports"]) {
      const res = await get(`/admin/export/${kind}`, admin);
      expect(res.status, kind).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      // Read raw bytes: text decoding would silently drop the BOM we're checking for.
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    }
    const { data } = await service.from("admin_audit_logs").select("entity_type").eq("actor_id", admin.userId).eq("action", "csv_export");
    expect(data!.map((r) => r.entity_type).sort()).toEqual(["listings", "reports", "users"]);
  });
});

describe("contact page", () => {
  it("shows the general form and the listing report form", async () => {
    expect((await get("/contact")).status).toBe(200);
    const res = await get(`/contact?listing=${demoListingId}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(String(demoListingId));
  });
});
