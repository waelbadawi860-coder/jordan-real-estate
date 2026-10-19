import { z } from "zod";

// Error messages are translation keys from messages/*.json → auth.errors.
export const emailSchema = z.string().trim().toLowerCase().email("invalidEmail").max(254, "invalidEmail");

export const passwordSchema = z
  .string()
  .min(8, "weakPassword")
  .max(72, "weakPassword")
  .refine((p) => /[A-Za-z؀-ۿ]/.test(p) && /[0-9]/.test(p), "weakPassword");

export const displayNameSchema = z.string().trim().min(2, "nameInvalid").max(60, "nameInvalid");

export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal("on", { message: "termsRequired" }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "invalidCredentials").max(200, "invalidCredentials"),
});
