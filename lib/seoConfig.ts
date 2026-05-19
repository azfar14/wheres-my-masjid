export const siteName = "Where’s My Masjid";

export const siteTitle = "Where’s My Masjid | Nearby Masjids, Qibla Direction & Jamaat Timings";

export const siteDescription =
  "Find nearby masjids, Qibla direction, jamaat timings, saved masjids, verified updates, and claim tools for authorised masjid teams.";

export const siteKeywords = [
  "Where's My Masjid",
  "Where’s My Masjid",
  "nearby masjid",
  "masjid near me",
  "mosque near me",
  "jamaat timings",
  "prayer times",
  "qibla direction",
  "qibla compass",
  "Jumuah timings",
  "masjid finder",
  "mosque finder",
  "Islamic app",
  "Muslim app",
  "verified masjid updates",
  "masjid claim",
  "Wannaapps Technologies"
];

export function getSiteUrl(): string | undefined {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!rawUrl) return undefined;

  try {
    return new URL(rawUrl).origin;
  } catch {
    return undefined;
  }
}

export function absoluteUrl(pathname = "/"): string {
  const baseUrl = getSiteUrl() ?? "https://example.com";
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}
