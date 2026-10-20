import { z } from "zod";

// Settings that are safe to expose to the browser. Each one must be written out
// literally (process.env.NEXT_PUBLIC_...) so Next.js can embed it at build time.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "must be the Supabase project URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, { message: "must be the Supabase publishable (anon) key" })
    .refine((key) => !key.startsWith("sb_secret_"), {
      message: "is a SECRET key — use the publishable key here",
    }),
  NEXT_PUBLIC_SITE_URL: z.url({ message: "must be the site's address, e.g. http://localhost:3000" }),
});

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".")} ${issue.message}`).join("\n");
}

const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsedPublic.success) {
  throw new Error(
    `Missing or invalid settings in web/.env.local:\n${formatIssues(parsedPublic.error)}\n` +
      "See docs/STAGE-2-SETUP.md for how to fill them in.",
  );
}

export const publicEnv = parsedPublic.data;

/**
 * "live" only on the real public site (set SITE_STAGE=live in Vercel). Test
 * copies (staging on *.vercel.app, your computer) are hidden from search engines.
 */
export const isLiveSite = process.env.SITE_STAGE === "live";

// Email links, shared links, the sitemap and search-engine addresses are all
// built from NEXT_PUBLIC_SITE_URL, so the live site must never use a test value.
if (isLiveSite && !/^https:\/\/(?!localhost|127\.0\.0\.1)/.test(publicEnv.NEXT_PUBLIC_SITE_URL)) {
  throw new Error(
    `NEXT_PUBLIC_SITE_URL is "${publicEnv.NEXT_PUBLIC_SITE_URL}" but SITE_STAGE=live: set it to the real https address (e.g. https://www.yourname.com).`,
  );
}

// Extra safety rules for the live site.
if (isLiveSite) {
  const site = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
  if (site.protocol !== "https:" || site.hostname === "localhost" || site.hostname.endsWith(".vercel.app")) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be the real https:// domain in production (e.g. https://www.example.com).");
  }
}

// Server-only settings. Read lazily so the browser bundle never touches them.
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20, { message: "must be the Supabase secret (service_role) key" }),
});

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("Server settings must never be read in the browser.");
  }
  const parsed = serverSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
  if (!parsed.success) {
    throw new Error(`Missing or invalid server settings:\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}
