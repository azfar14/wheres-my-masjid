import type { DataSource, Masjid, VerificationStatus } from "@/types";

function hasUsefulName(masjid: Masjid): boolean {
  return !/^unnamed\b/i.test(masjid.name) && !/osm-(node|way|relation)-/i.test(masjid.name);
}

export function hasVerifiedTimings(masjid: Masjid): boolean {
  return masjid.verificationStatus === "admin_verified" || masjid.verificationStatus === "community_checked";
}

export function isOpenStreetMapListing(masjid: Masjid): boolean {
  return masjid.verificationStatus === "osm_discovered" || masjid.source === "openstreetmap";
}

export function isGooglePlacesListing(masjid: Masjid): boolean {
  return masjid.verificationStatus === "google_discovered" || masjid.source === "google_places";
}

export function isMapplsListing(masjid: Masjid): boolean {
  return masjid.verificationStatus === "mappls_discovered" || masjid.source === "mappls";
}

export function isFoursquareListing(masjid: Masjid): boolean {
  return masjid.verificationStatus === "foursquare_discovered" || masjid.source === "foursquare";
}

export function isExternalDiscoveredListing(masjid: Masjid): boolean {
  return isOpenStreetMapListing(masjid) || isGooglePlacesListing(masjid) || isMapplsListing(masjid) || isFoursquareListing(masjid);
}

export function isLowConfidenceListing(masjid: Masjid): boolean {
  if (hasVerifiedTimings(masjid)) return false;
  if (masjid.discoveryQuality === "low") return true;
  if (isOpenStreetMapListing(masjid)) return masjid.osmConfidence === "unnamed" || masjid.osmConfidence === "possible" || !hasUsefulName(masjid);
  return false;
}

export function verificationLabel(status: VerificationStatus, source?: DataSource): string {
  if (source && source !== "firebase" && source !== "local_discovery") return "Demo";
  if (status === "admin_verified") return "Verified";
  if (status === "community_checked") return "Community checked";
  if (status === "mappls_discovered") return "Mappls";
  if (status === "foursquare_discovered") return "Foursquare";
  if (status === "google_discovered") return "Google";
  if (status === "osm_discovered") return "OpenStreetMap";
  return "Needs verification";
}

export function timingTrustLabel(masjid: Masjid): string {
  if (masjid.verificationStatus === "admin_verified") return "Verified jamaat";
  if (masjid.verificationStatus === "community_checked") return "Community checked";
  if (isMapplsListing(masjid)) return "Timing unknown — Mappls listing";
  if (isFoursquareListing(masjid)) return "Timing unknown — Foursquare listing";
  if (isGooglePlacesListing(masjid)) return "Timing unknown — Google listing";
  if (isOpenStreetMapListing(masjid)) return isLowConfidenceListing(masjid) ? "Unverified OSM pin" : "Timing unknown — OSM listing";
  return "Needs verification";
}

export function verificationNotice(masjid: Masjid, source?: DataSource): string {
  if (source && source !== "firebase" && source !== "local_discovery") {
    return "This is demo data. Real launch listings must be verified by masjid admins or trusted volunteers.";
  }

  if (masjid.verificationStatus === "admin_verified") {
    return "This listing is admin verified. Keep it accurate through the admin panel.";
  }

  if (masjid.verificationStatus === "community_checked") {
    return "This listing has been community checked. Ask a masjid admin to verify it for launch confidence.";
  }

  if (isMapplsListing(masjid)) {
    return "This masjid came from Mappls/MapmyIndia. Use it for location discovery, then verify the exact pin and jamaat timings locally.";
  }

  if (isFoursquareListing(masjid)) {
    return "This masjid came from Foursquare Places. Use it for location discovery, then verify the exact pin and jamaat timings locally.";
  }

  if (isGooglePlacesListing(masjid)) {
    return "This masjid came from Google Places. Use it for accurate navigation; jamaat timings still need local/admin verification before countdowns are trusted.";
  }

  if (isOpenStreetMapListing(masjid)) {
    if (isLowConfidenceListing(masjid)) {
      return "This came from OpenStreetMap, but the map object does not have a clear public masjid name. Check the exact pin or use a Maps search fallback before navigating, then submit the correct name and jamaat timings.";
    }
    return "This masjid was discovered from OpenStreetMap near the user’s location. Use it for navigation, then verify jamaat timings locally before showing countdowns.";
  }

  return "This is a real masjid listing, but the jamaat timings still need local verification before public launch.";
}

export function listingQualityPenalty(masjid: Masjid): number {
  if (masjid.verificationStatus === "admin_verified") return 0;
  if (masjid.verificationStatus === "community_checked") return 0.05;
  if (isGooglePlacesListing(masjid)) return 0.06;
  if (isMapplsListing(masjid)) return 0.08;
  if (isFoursquareListing(masjid)) return 0.12;
  if (isGooglePlacesListing(masjid)) return 0.14;
  if (isOpenStreetMapListing(masjid)) {
    if (masjid.discoveryQuality === "high") return 0.18;
    if (masjid.osmConfidence === "named") return 0.3;
    if (masjid.osmConfidence === "possible") return 0.9;
    return 2;
  }
  return 1;
}
