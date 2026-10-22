/**
 * Office pages: the owner's "My office", the public office page with the
 * "verified office" badge, and the admin offices page.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestSession, deleteTestSession, get, service, type TestSession } from "./helpers";

let owner: TestSession;
let admin: TestSession;
let officeId: number;
const officeName = `Smoke Office ${Date.now()}`;

beforeAll(async () => {
  owner = await createTestSession("office");
  admin = await createTestSession("office-admin", "admin");
  const { data, error } = await service
    .from("offices")
    .insert({
      owner_id: owner.userId,
      name: officeName,
      about: "Smoke test office",
      plan_slug: "pro",
      plan_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      verified_until: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  officeId = data.id;
});

afterAll(async () => {
  await deleteTestSession(owner);
  await deleteTestSession(admin);
});

describe("offices", () => {
  it("shows the owner their office, badge and package", async () => {
    const res = await get("/my/office", owner);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(officeName);
    expect(html).toContain("مكتب موثّق");
    expect(html).toContain("المتقدمة");
  });

  it("asks people without an office to create one", async () => {
    const res = await get("/my/office", admin);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("إنشاء صفحة المكتب");
  });

  it("has a public office page with the badge and what it means", async () => {
    const res = await get(`/office/${officeId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(officeName);
    expect(html).toContain("لا تعني ضماناً");
    expect((await get("/office/999999999")).status).toBe(404);
  });

  it("lists offices for admins only", async () => {
    const res = await get("/admin/offices", admin);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(officeName);
    expect((await get("/admin/offices", owner)).status).toBe(404);
  });
});
