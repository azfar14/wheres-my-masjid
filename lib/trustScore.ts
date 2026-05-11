import type { Masjid, TrustScore } from "@/types";
import { hasVerifiedTimings, isFoursquareListing, isGooglePlacesListing, isLowConfidenceListing, isMapplsListing, isOpenStreetMapListing } from "@/lib/verification";

function daysSince(dateLike: string): number | undefined {
  const parsed = Date.parse(dateLike);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.round((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
}

export function calculateTrustScore(masjid: Masjid): TrustScore {
  const reasons: string[] = [];
  let score = 25;

  if (masjid.verificationStatus === "admin_verified") {
    score += 45;
    reasons.push("admin verified");
  } else if (masjid.verificationStatus === "community_checked") {
    score += 35;
    reasons.push("community checked");
  } else if (isGooglePlacesListing(masjid)) {
    score += 31;
    reasons.push("Google Places discovery");
  } else if (isMapplsListing(masjid)) {
    score += 26;
    reasons.push("Mappls discovery");
  } else if (isFoursquareListing(masjid)) {
    score += 23;
    reasons.push("Foursquare discovery");
  } else if (isOpenStreetMapListing(masjid)) {
    score += masjid.osmConfidence === "named" ? 15 : 4;
    reasons.push(masjid.osmConfidence === "named" ? "named OSM listing" : "unnamed/weak OSM pin");
  }

  if (typeof masjid.providerConfidence === "number") {
    score += Math.round(Math.min(10, Math.max(0, masjid.providerConfidence - 60) / 4));
    reasons.push("provider confidence");
  }

  if (masjid.discoveryQuality === "high") {
    score += 6;
    reasons.push("high-quality discovery tags");
  } else if (masjid.discoveryQuality === "low") {
    score -= 8;
    reasons.push("low-quality discovery tags");
  }

  if (hasVerifiedTimings(masjid)) {
    score += 15;
    reasons.push("jamaat timings available");
  }

  if (masjid.phone) {
    score += 4;
    reasons.push("phone added");
  }

  if (masjid.facilities.length) {
    score += 3;
    reasons.push("facilities added");
  }

  const age = daysSince(masjid.lastVerifiedAt);
  if (age !== undefined && age <= 7) {
    score += 8;
    reasons.push("checked this week");
  } else if (age !== undefined && age <= 30) {
    score += 5;
    reasons.push("checked this month");
  } else if (age !== undefined && age > 90) {
    score -= 8;
    reasons.push("needs recent check");
  }

  if (isLowConfidenceListing(masjid)) {
    score -= 25;
    reasons.push("low-confidence pin");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const level = finalScore >= 85 ? "verified" : finalScore >= 65 ? "strong" : finalScore >= 40 ? "medium" : "low";
  const label = level === "verified" ? "Verified trust" : level === "strong" ? "Strong trust" : level === "medium" ? "Needs check" : "Low confidence";

  return { score: finalScore, level, label, reasons };
}
