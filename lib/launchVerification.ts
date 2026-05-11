import type { Coordinates, Masjid } from "@/types";
import { hasVerifiedTimings, isExternalDiscoveredListing } from "@/lib/verification";

export type LaunchReadiness = {
  verifiedCount: number;
  verifiedWithTimingsCount: number;
  externalCount: number;
  needsVerificationCount: number;
  score: number;
  status: "not_ready" | "private_beta" | "local_launch_ready";
  messages: string[];
};

function finite(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseGoogleMapsCoordinates(input: string): Coordinates | undefined {
  const value = input.trim();
  if (!value) return undefined;

  const decoded = decodeURIComponent(value);
  const patterns: RegExp[] = [
    /@([+-]?\d{1,2}\.\d+),\s*([+-]?\d{1,3}\.\d+)/,
    /[?&](?:q|query|destination|ll)=([+-]?\d{1,2}\.\d+),\s*([+-]?\d{1,3}\.\d+)/,
    /!3d([+-]?\d{1,2}\.\d+)!4d([+-]?\d{1,3}\.\d+)/,
    /\b([+-]?\d{1,2}\.\d{4,})\s*,\s*([+-]?\d{1,3}\.\d{4,})\b/
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    const lat = finite(match?.[1]);
    const lng = finite(match?.[2]);
    if (lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return undefined;
}

export function isVerifiedNavigationListing(masjid: Pick<Masjid, "verificationStatus" | "source" | "googlePlaceId">): boolean {
  return masjid.verificationStatus === "admin_verified" || masjid.verificationStatus === "community_checked" || Boolean(masjid.googlePlaceId) || masjid.source === "google_places";
}

export function launchReadinessFor(masjids: Masjid[]): LaunchReadiness {
  const verified = masjids.filter((masjid) => masjid.verificationStatus === "admin_verified" || masjid.verificationStatus === "community_checked");
  const verifiedWithTimings = verified.filter(hasVerifiedTimings);
  const external = masjids.filter(isExternalDiscoveredListing);
  const needsVerification = masjids.filter((masjid) => !hasVerifiedTimings(masjid));

  const verifiedScore = Math.min(50, verified.length * 3);
  const timingScore = Math.min(35, verifiedWithTimings.length * 2.5);
  const opsScore = masjids.length > 0 ? 10 : 0;
  const score = Math.round(Math.min(100, verifiedScore + timingScore + opsScore));

  const messages: string[] = [];
  if (verified.length < 10) messages.push("Add at least 10 verified masjids in your first launch area.");
  if (verifiedWithTimings.length < 10) messages.push("Add verified jamaat timings for each launch-area masjid.");
  if (external.length > verified.length * 2) messages.push("External discovery is useful, but verified Firestore listings must become the trusted launch layer.");
  if (!messages.length) messages.push("Your launch-area trust layer is strong enough for local beta testing.");

  const status = score >= 75 ? "local_launch_ready" : score >= 40 ? "private_beta" : "not_ready";

  return {
    verifiedCount: verified.length,
    verifiedWithTimingsCount: verifiedWithTimings.length,
    externalCount: external.length,
    needsVerificationCount: needsVerification.length,
    score,
    status,
    messages
  };
}
