"use server";

import { redirect } from "next/navigation";
import { hasLocale, localePath, type Locale } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth";
import { withinVisitorLimit } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, loginSchema, passwordSchema, registerSchema } from "@/lib/validation/auth";

/** Result shown by auth forms. Values are translation keys (auth.errors.* or auth.*). */
export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

type AuthErrorLike = { code?: string; status?: number; message?: string } | null;

function authErrorKey(error: AuthErrorLike): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    case "reauthentication_needed":
      return "reauthRequired";
    case "session_not_found":
    case "session_expired":
      return "sessionMissing";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
  }
  if (error?.status === 429) return "rateLimited";
  return "generic";
}

/** Per-visitor limits on top of Supabase's own, to slow password guessing and email spam. */
async function allowed(action: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    return await withinVisitorLimit(action, max, windowSeconds);
  } catch {
    return true; // never lock everyone out if the limiter itself is unavailable
  }
}

function localeFrom(formData: FormData): Locale {
  const lang = String(formData.get("lang") ?? "");
  return hasLocale(lang) ? lang : "ar";
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeFrom(formData);
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  if (!(await allowed("register", 5, 3600))) return { error: "rateLimited" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}${localePath(locale, "/auth/callback")}?next=${encodeURIComponent(localePath(locale, "/my/listings"))}`,
      data: { display_name: parsed.data.displayName, preferred_language: locale },
    },
  });
  if (error) return { error: authErrorKey(error) };

  // Record consent to the current terms/privacy versions. Supabase returns a
  // placeholder user with no identities when the email is already registered;
  // in that case nothing is recorded and the same message is shown, so the
  // form can't be used to discover who has an account.
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    const admin = createAdminClient();
    const { data: versions } = await admin
      .from("site_settings")
      .select("key, value")
      .in("key", ["terms_version", "privacy_version"]);
    const version = (key: string) => String(versions?.find((v) => v.key === key)?.value ?? "unknown");
    const { error: consentError } = await admin.from("user_consents").insert([
      { user_id: data.user.id, document: "terms", version: version("terms_version") },
      { user_id: data.user.id, document: "privacy", version: version("privacy_version") },
    ]);
    if (consentError) console.error("Recording consent failed", { message: consentError.message });
  }

  return { success: "checkEmail" };
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeFrom(formData);
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "invalidCredentials" };
  if (!(await allowed("login", 20, 600))) return { error: "rateLimited" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorKey(error) };

  redirect(safeNextPath(formData.get("next"), localePath(locale, "/my/listings")));
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(localePath(locale, "/"));
}

export async function requestPasswordResetAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeFrom(formData);
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { fieldErrors: { email: "invalidEmail" } };
  if (!(await allowed("reset", 5, 3600))) return { error: "rateLimited" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}${localePath(locale, "/auth/callback")}?next=${encodeURIComponent(localePath(locale, "/reset-password"))}`,
  });
  // Same message whether or not the email exists (except rate limiting).
  if (error && authErrorKey(error) === "rateLimited") return { error: "rateLimited" };
  if (error) console.error("Password reset request failed", { code: error.code });
  return { success: "resetSent" };
}

export async function updatePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { fieldErrors: { password: "weakPassword" } };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "sessionMissing" };

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authErrorKey(error) };
  return { success: "passwordUpdated" };
}
