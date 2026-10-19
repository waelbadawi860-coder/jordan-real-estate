// Gives an existing account administrator rights.
// Usage (from the web folder):  npm run make-admin -- someone@example.com
// Uses the secret key from .env.local, so it only works on a trusted computer.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Please give the account's email, e.g.  npm run make-admin -- you@example.com");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false } });

let user;
for (let page = 1; !user; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (data.users.length < 1000) break;
}
if (!user) {
  console.error(`No account found for ${email}. Register on the site first.`);
  process.exit(1);
}

const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
if (error) throw error;

await supabase.from("admin_audit_logs").insert({
  actor_id: null,
  action: "grant_admin",
  entity_type: "profile",
  entity_id: user.id,
  details: { via: "make-admin script" },
});

console.log(`Done: ${email} is now an administrator.`);
