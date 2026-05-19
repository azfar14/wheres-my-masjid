import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seoConfig";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/diagnostics", "/qa"]
      }
    ],
    sitemap: siteUrl ? absoluteUrl("/sitemap.xml") : undefined
  };
}
