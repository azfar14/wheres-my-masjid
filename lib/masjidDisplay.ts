import type { Masjid } from "@/types";
import { hasVerifiedTimings, isExternalDiscoveredListing, isFoursquareListing, isGooglePlacesListing, isMapplsListing, isOpenStreetMapListing } from "@/lib/verification";

const GENERIC_NAME_PATTERNS = [
  /^masjid\s*\/\s*prayer\s*place/i,
  /^unnamed\b/i,
  /^islamic\s+prayer\s+place$/i,
  /^masjid\s+discovered\b/i,
  /^osm-(node|way|relation)-/i,
  /^mosque\s*$/i,
  /^masjid\s*$/i,
  /\b(mosque|masjid)\s+(street|st|road|rd|lane|ln|avenue|ave|cross|main|2nd|3rd|4th|thottam|garden|gardens|colony|nagar|layout|division|ward|zone|junction)\b/i,
  /\b(street|road|lane|cross|main|division|ward)\b.*\b(mosque|masjid)\b/i,
  /^cmwssb\b/i
];

const MASJID_WORDS = /masjid|mosque|musalla|musallah|musholla|surau|pallivasal|juma|jumma|jamia|jama|jame|eidgah|islamic centre|islamic center|مسجد|جامع|مصلى|मस्जिद|பள்ளிவாசல்|மசூதி|മസ്ജിദ്|മസീതി|ಮಸೀದಿ|మసీదు|মসজিদ/i;

function clean(value?: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function isGenericMasjidName(name?: string): boolean {
  const value = clean(name);
  if (!value) return true;
  if (GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(value))) return true;

  // Street/locality names that merely contain the word mosque should not be
  // displayed as if they are the actual public name of a masjid.
  const lower = value.toLowerCase();
  if ((lower.includes("mosque") || lower.includes("masjid")) && /street|road|lane|cross|main|division|ward|thottam|colony/.test(lower)) return true;
  return false;
}

export function hasRealPublicName(masjid: Pick<Masjid, "name" | "source" | "verificationStatus">): boolean {
  if (masjid.verificationStatus === "admin_verified" || masjid.verificationStatus === "community_checked") return Boolean(clean(masjid.name));
  return !isGenericMasjidName(masjid.name);
}

function bestAreaCandidate(masjid: Pick<Masjid, "locality" | "address" | "coordinates">): string {
  const locality = clean(masjid.locality);
  if (locality && !/^nearby area$/i.test(locality)) return locality;

  const address = clean(masjid.address);
  const parts = address
    .split(",")
    .map((part) => clean(part))
    .filter(Boolean)
    .filter((part) => !/^openstreetmap pin/i.test(part))
    .filter((part) => !/^[+-]?\d+(\.\d+)?\s*[+-]?\d+(\.\d+)?$/.test(part));

  return parts.slice(0, 2).join(", ") || `${masjid.coordinates.lat.toFixed(4)}, ${masjid.coordinates.lng.toFixed(4)}`;
}

export function displayMasjidName(masjid: Masjid): string {
  const name = clean(masjid.name);
  if (!isGenericMasjidName(name)) return name;

  const area = bestAreaCandidate(masjid);
  if (isOpenStreetMapListing(masjid)) return `Possible masjid near ${area}`;
  if (isGooglePlacesListing(masjid)) return `Masjid near ${area}`;
  if (isMapplsListing(masjid)) return `Masjid near ${area}`;
  if (isFoursquareListing(masjid)) return `Masjid near ${area}`;
  return `Masjid near ${area}`;
}

export function displayMasjidLocality(masjid: Masjid): string {
  const area = bestAreaCandidate(masjid);
  if (isGenericMasjidName(masjid.name) && isExternalDiscoveredListing(masjid)) {
    return `Name not provided by map data · ${area}`;
  }
  return area;
}


function sourceLabel(source?: Masjid["source"]): string {
  if (source === "google_places") return "Google";
  if (source === "mappls") return "Mappls";
  if (source === "foursquare") return "Foursquare";
  if (source === "openstreetmap") return "OSM";
  if (source === "community_report") return "Community";
  if (source === "firestore") return "Verified DB";
  return source ?? "source";
}

export function displayProviderFusionLabel(masjid: Pick<Masjid, "providerSources" | "source">): string | undefined {
  const sources = Array.from(new Set([...(masjid.providerSources ?? []), masjid.source].filter(Boolean) as NonNullable<Masjid["source"]>[]));
  if (sources.length <= 1) return undefined;
  const preferredOrder: NonNullable<Masjid["source"]>[] = ["firestore", "google_places", "mappls", "foursquare", "openstreetmap", "community_report", "demo"];
  const sorted = sources.sort((a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b));
  return `Matched by ${sorted.map(sourceLabel).join(" + ")}`;
}

export function displaySourceBadge(masjid: Masjid): string {
  if (masjid.verificationStatus === "admin_verified") return "Admin verified";
  if (masjid.verificationStatus === "community_checked") return "Community checked";
  const fusionLabel = displayProviderFusionLabel(masjid);
  if (fusionLabel) return fusionLabel;
  if (isGooglePlacesListing(masjid)) return "Google discovery";
  if (isMapplsListing(masjid)) return "Mappls discovery";
  if (isFoursquareListing(masjid)) return "Foursquare discovery";
  if (isOpenStreetMapListing(masjid)) return "OSM discovery";
  if (masjid.source === "community_report") return "Community report";
  return "Needs verification";
}

export function displayTrustLabel(masjid: Masjid): string {
  if (masjid.verificationStatus === "admin_verified") return "Trusted listing";
  if (masjid.verificationStatus === "community_checked") return "Community checked";
  if (hasVerifiedTimings(masjid)) return "Verified timings";
  if (!hasRealPublicName(masjid)) return "Exact name needed";
  if (isExternalDiscoveredListing(masjid)) return "Location discovered";
  return "Needs local verification";
}

export function displayTimingLabel(masjid: Masjid): string {
  if (masjid.verificationStatus === "admin_verified") return "Verified jamaat";
  if (masjid.verificationStatus === "community_checked") return "Community checked";
  return "Timing unknown";
}

export function displayVerificationNotice(masjid: Masjid): string {
  if (masjid.verificationStatus === "admin_verified") return "Verified by an admin. Jamaat timings can be trusted unless the masjid updates them.";
  if (masjid.verificationStatus === "community_checked") return "Community checked. Ask the masjid committee to claim and verify for full trust.";
  if (!hasRealPublicName(masjid)) return "The map source found a likely masjid/prayer place, but did not provide a reliable public name. Open the exact pin, confirm the name locally, then submit a correction.";
  if (isExternalDiscoveredListing(masjid)) return "Discovered from map data. Verify the real Google Maps listing before navigation; submit the exact pin and jamaat timings to make it trusted.";
  return "Needs local verification before public jamaat countdowns are shown.";
}

export function searchableMasjidText(masjid: Masjid): string {
  return [
    masjid.name,
    displayMasjidName(masjid),
    masjid.locality,
    masjid.address,
    masjid.facilities.join(" "),
    masjid.khutbahLanguages.join(" "),
    masjid.source ?? "",
    (masjid.providerSources ?? []).join(" "),
    masjid.verificationStatus,
    displaySourceBadge(masjid),
    displayTrustLabel(masjid)
  ]
    .join(" ")
    .toLowerCase();
}

export function hasFacility(masjid: Masjid, regex: RegExp): boolean {
  return masjid.facilities.some((facility) => regex.test(facility));
}

export function primaryMasjidActionLabel(masjid: Masjid): string {
  if (isExternalDiscoveredListing(masjid) && masjid.verificationStatus !== "admin_verified" && masjid.verificationStatus !== "community_checked" && !masjid.googlePlaceId) {
    return "Verify & navigate";
  }
  return "Start nav";
}

export function isLikelyStreetOnlyFalsePositive(masjid: Masjid): boolean {
  if (!isOpenStreetMapListing(masjid)) return false;
  const value = clean(masjid.name).toLowerCase();
  if (!value) return false;
  const looksLikeRoad = /\b(street|st|road|rd|lane|ln|cross|main|thottam|division|ward|cmwssb)\b/.test(value);
  const hasOnlyRoadLikeName = looksLikeRoad && /\b(mosque|masjid)\b/.test(value);
  return hasOnlyRoadLikeName && masjid.discoveryQuality !== "high";
}

export function sourceClassName(masjid: Masjid): string {
  if (masjid.verificationStatus === "admin_verified") return "source-verified";
  if (masjid.verificationStatus === "community_checked") return "source-community";
  if (isGooglePlacesListing(masjid)) return "source-google";
  if (isMapplsListing(masjid)) return "source-mappls";
  if (isFoursquareListing(masjid)) return "source-foursquare";
  if (isOpenStreetMapListing(masjid)) return "source-osm";
  return "source-unverified";
}
