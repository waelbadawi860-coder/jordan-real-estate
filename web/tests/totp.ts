import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Test admins confirm a two-step login like a real admin would, so the tests
// keep working while "admins must use two-step login" is switched on.

function base32ToBuffer(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** The current 6-digit code of an authenticator app (RFC 6238: SHA-1, 30 seconds). */
export function totpCode(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac("sha1", base32ToBuffer(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/** Sets up an authenticator for the signed-in user and upgrades the session to two-step (aal2). */
export async function confirmTwoStep(client: SupabaseClient): Promise<void> {
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error) throw enrolled.error;
  const challenge = await client.auth.mfa.challenge({ factorId: enrolled.data.id });
  if (challenge.error) throw challenge.error;
  const verified = await client.auth.mfa.verify({
    factorId: enrolled.data.id,
    challengeId: challenge.data.id,
    code: totpCode(enrolled.data.totp.secret),
  });
  if (verified.error) throw verified.error;
}
