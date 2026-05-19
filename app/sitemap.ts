import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seoConfig";

const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/nearby", priority: 0.95, changeFrequency: "daily" },
  { path: "/qibla", priority: 0.9, changeFrequency: "monthly" },
  { path: "/saved", priority: 0.65, changeFrequency: "weekly" },
  { path: "/claim", priority: 0.75, changeFrequency: "weekly" },
  { path: "/missing", priority: 0.7, changeFrequency: "weekly" },
  { path: "/network", priority: 0.75, changeFrequency: "weekly" },
  { path: "/notifications", priority: 0.55, changeFrequency: "monthly" },
  { path: "/offline", priority: 0.35, changeFrequency: "yearly" }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
