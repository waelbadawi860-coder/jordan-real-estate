import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { confirmTwoStep } from "../totp";

export const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
export const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export type TestSession = { userId: string; email: string; cookie: string; accessToken: string };

/** Creates a temporary confirmed user and logs in the same way the website does. */
export async function createTestSession(label: string, role: "user" | "admin" = "user"): Promise<TestSession> {
  const email = `smoke-${label}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `${randomUUID()}Aa1`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Smoke ${label}` },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  if (role === "admin") await service.from("profiles").update({ role: "admin" }).eq("id", userId);

  // Latest value per cookie name (the two-step upgrade replaces the session cookies).
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const signIn = await ssr.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  if (role === "admin") await confirmTwoStep(ssr);
  const consent = await ssr.rpc("accept_current_terms");
  if (consent.error) throw consent.error;
  const { data: session } = await ssr.auth.getSession();
  return {
    userId,
    email,
    cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    accessToken: session.session!.access_token,
  };
}

export async function deleteTestSession(session: TestSession | undefined) {
  if (!session) return;
  await service.from("listings").delete().eq("seller_id", session.userId);
  await service.auth.admin.deleteUser(session.userId);
}

export function get(path: string, session?: TestSession) {
  return fetch(`${base}${path}`, { redirect: "manual", headers: session ? { cookie: session.cookie } : {} });
}
