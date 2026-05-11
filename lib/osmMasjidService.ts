import type { Coordinates, Masjid } from "@/types";
import { distanceKm } from "@/lib/geo";
import { isLikelyStreetOnlyFalsePositive } from "@/lib/masjidDisplay";

export type OsmNearbyApiResponse = {
  masjids: Masjid[];
  message?: string;
  endpoint?: string;
  radiusKm?: number;
  overpassCount?: number;
  nominatimCount?: number;
  diagnostics?: string[];
  coverageGrade?: "good" | "partial" | "thin";
};

function normalizedName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(unnamed|masjid|mosque|jamia|jama|juma|jumma|musalla|masjid-e|masjid e|prayer|place)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function confidenceScore(masjid: Masjid): number {
  if (masjid.source === "firestore" || masjid.verificationStatus === "admin_verified") return 100;
  if (masjid.verificationStatus === "community_checked") return 90;
  if (masjid.source === "google_places" || masjid.verificationStatus === "google_discovered") return 88;
  if (masjid.source === "mappls" || masjid.verificationStatus === "mappls_discovered") return 82;
  if (masjid.source === "foursquare" || masjid.verificationStatus === "foursquare_discovered") return 72;
  if (masjid.source === "openstreetmap" && masjid.osmConfidence === "named") return 50;
  if (masjid.source === "openstreetmap" && masjid.osmConfidence === "possible") return 25;
  if (masjid.source === "openstreetmap") return 10;
  return 0;
}

function looksLikeSameMasjid(a: Masjid, b: Masjid, reference?: Coordinates): boolean {
  const distance = distanceKm(a.coordinates, b.coordinates);
  const close = distance < 0.12;
  const veryClose = distance < 0.035;
  const nameA = normalizedName(a.name);
  const nameB = normalizedName(b.name);
  const namesMatch = Boolean(nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA)));

  if (a.osm && b.osm && a.osm.type === b.osm.type && a.osm.id === b.osm.id) return true;
  if (veryClose && (namesMatch || !nameA || !nameB || a.osmConfidence === "unnamed" || b.osmConfidence === "unnamed")) return true;
  if (close && namesMatch) return true;
  if (reference) {
    const aDistance = distanceKm(reference, a.coordinates);
    const bDistance = distanceKm(reference, b.coordinates);
    return close && Math.abs(aDistance - bDistance) < 0.08 && namesMatch;
  }
  return false;
}

function simplifyOsmApiError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error("OpenStreetMap search could not finish. Showing verified/saved listings now.");
}

export async function fetchNearbyOsmMasjids(location: Coordinates, radiusKm = 5): Promise<Masjid[]> {
  const params = new URLSearchParams({
    lat: String(location.lat),
    lng: String(location.lng),
    radiusKm: String(radiusKm)
  });

  const response = await fetch(`/api/osm-masjids?${params.toString()}`);
  const data = (await response.json()) as { masjids?: Masjid[]; message?: string };

  if (!response.ok) {
    throw new Error(data.message || `OpenStreetMap search failed (${response.status}).`);
  }

  return Array.isArray(data.masjids)
    ? data.masjids.sort((a, b) => {
        const distanceDelta = distanceKm(location, a.coordinates) - distanceKm(location, b.coordinates);
        if (Math.abs(distanceDelta) > 0.25) return distanceDelta;
        return confidenceScore(b) - confidenceScore(a);
      })
    : [];
}

export function mergeMasjidSources(primaryMasjids: Masjid[], discoveredMasjids: Masjid[], reference?: Coordinates): Masjid[] {
  const result: Masjid[] = primaryMasjids
    .filter((masjid) => !isLikelyStreetOnlyFalsePositive(masjid))
    .map((masjid) => ({ ...masjid, source: masjid.source ?? "firestore" }));

  for (const discovered of discoveredMasjids) {
    if (isLikelyStreetOnlyFalsePositive(discovered)) continue;
    const duplicateIndex = result.findIndex((existing) => looksLikeSameMasjid(existing, discovered, reference));

    if (duplicateIndex === -1) {
      result.push(discovered);
      continue;
    }

    const existing = result[duplicateIndex];
    if ((existing.source === "openstreetmap" || existing.verificationStatus === "osm_discovered") && confidenceScore(discovered) > confidenceScore(existing)) {
      result[duplicateIndex] = discovered;
    }
  }

  return result;
}
