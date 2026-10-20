import type { MetadataRoute } from "next";
import { isLiveSite, publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // Test copies (staging, your computer) must never appear in search results.
  if (!isLiveSite) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or not-yet-ready areas.
      disallow: ["/admin", "/en/admin", "/my", "/en/my", "/post", "/en/post", "/login", "/en/login"],
    },
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
