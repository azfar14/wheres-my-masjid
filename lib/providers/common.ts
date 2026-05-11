import type { Coordinates, DiscoveryQuality, ListingSource, Masjid, VerificationStatus } from "@/types";
import { distanceKm } from "@/lib/geo";

export type DiscoveryProvider = "firestore" | "google_places" | "mappls" | "foursquare" | "openstreetmap" | "nominatim" | "community";

export type ProviderMasjidResponse = {
  provider: DiscoveryProvider;
  enabled: boolean;
  masjids: Masjid[];
  count: number;
  cached?: boolean;
  message?: string;
  error?: string;
  diagnostics?: string[];
  durationMs?: number;
};

export const FALLBACK_JAMAAT = {
  fajr: "05:10",
  dhuhr: "13:30",
  asr: "17:15",
  maghrib: "18:45",
  isha: "20:15"
};

export const MASJID_KEYWORDS = [
  "masjid",
  "mosque",
  "musalla",
  "musholla",
  "surau",
  "pallivasal",
  "jumma masjid",
  "jamia masjid",
  "juma masjid",
  "islamic center",
  "islamic centre",
  "markaz",
  "eidgah",
  "prayer room",
  "muslim prayer"
];

export const INDIA_AND_NEIGHBOURS_BOUNDS = {
  minLat: 5,
  maxLat: 38,
  minLng: 67,
  maxLng: 98
};

export function isLikelyIndiaOrNeighbour(location: Coordinates): boolean {
  return (
    location.lat >= INDIA_AND_NEIGHBOURS_BOUNDS.minLat &&
    location.lat <= INDIA_AND_NEIGHBOURS_BOUNDS.maxLat &&
    location.lng >= INDIA_AND_NEIGHBOURS_BOUNDS.minLng &&
    location.lng <= INDIA_AND_NEIGHBOURS_BOUNDS.maxLng
  );
}

export function clampRadiusKm(value: number, maxKm = 25): number {
  if (!Number.isFinite(value)) return 5;
  return Math.min(maxKm, Math.max(0.3, Number(value.toFixed(1))));
}

export function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

export function stableSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "item";
}

export function cleanName(value?: string): string {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed || "Unnamed masjid";
}

export function looksLikeMasjidText(value: string): boolean {
  return /masjid|masjidh|masjith|masjithu|mosque|mosquee|musalla|musallah|mussalla|musholla|mushola|surau|langgar|pallivasal|pallivaasal|palli|jumma|jummah|juma|jamia|jama|jami|markaz|eidgah|idgah|namaz|salah|prayer room|muslim prayer|islamic centre|islamic center|islamic society|islamic foundation|muslim|مسجد|جامع|مصلى|مصلّى|مركز اسلامي|मस्जिद|मसजिद|जामा|نماز|பள்ளிவாசல்|மசூதி|ஜும்மா|தொழுகை|പള്ളി|മസ്ജിദ്|ಪಳ್ಳಿ|ಮಸೀದಿ|ಮಸ್ಜಿದ್|మసీదు|মসজিদ|জামে/i.test(value);
}

export function providerStatusToVerification(provider: DiscoveryProvider): VerificationStatus {
  if (provider === "google_places") return "google_discovered";
  if (provider === "mappls") return "mappls_discovered";
  if (provider === "foursquare") return "foursquare_discovered";
  if (provider === "openstreetmap" || provider === "nominatim") return "osm_discovered";
  return "demo_unverified";
}

export function providerToSource(provider: DiscoveryProvider): ListingSource {
  if (provider === "google_places") return "google_places";
  if (provider === "mappls") return "mappls";
  if (provider === "foursquare") return "foursquare";
  if (provider === "openstreetmap" || provider === "nominatim") return "openstreetmap";
  if (provider === "community") return "community_report";
  return "firestore";
}

export function coordinatesToMapsParam(coordinates: Coordinates): string {
  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Cannot build a Google Maps URL without valid coordinates.");
  }
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// Use this only for admin/community verified pins. For raw provider discoveries,
// prefer lib/navigationTrust.ts so the user confirms the mosque in Google Maps first.
export function googleDirectionsUrlForMasjid(masjid: Pick<Masjid, "coordinates">, origin?: Coordinates): string {
  const params = new URLSearchParams({
    api: "1",
    destination: coordinatesToMapsParam(masjid.coordinates),
    travelmode: "walking",
    dir_action: "navigate"
  });

  if (origin) params.set("origin", coordinatesToMapsParam(origin));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleSearchUrlForMasjid(masjid: Pick<Masjid, "name" | "locality" | "coordinates">): string {
  const near = coordinatesToMapsParam(masjid.coordinates);
  const query = [masjid.name, masjid.locality, "mosque", "near", near]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildExternalMasjid(input: {
  provider: DiscoveryProvider;
  externalId: string;
  name: string;
  address?: string;
  locality?: string;
  coordinates: Coordinates;
  phone?: string;
  providerDistanceMeters?: number;
  coordinatesApproximate?: boolean;
  providerUrl?: string;
  googlePlaceId?: string;
  googleMapsUri?: string;
  mapplsELoc?: string;
  foursquareId?: string;
  quality?: DiscoveryQuality;
  notes?: string;
  providerConfidence?: number;
}): Masjid {
  const source = providerToSource(input.provider);
  const name = cleanName(input.name);
  const sourcePrefix = source === "openstreetmap" ? "osm" : source;
  const externalId = input.externalId || `${name}-${input.coordinates.lat}-${input.coordinates.lng}`;

  return {
    id: `${sourcePrefix}-${stableSlug(externalId)}`,
    name,
    locality: input.locality?.trim() || input.address?.split(",").slice(1, 3).join(",").trim() || "Nearby area",
    address: input.address?.trim() || `${name} · ${input.coordinates.lat.toFixed(6)}, ${input.coordinates.lng.toFixed(6)}`,
    coordinates: input.coordinates,
    phone: input.phone,
    facilities: [],
    khutbahLanguages: [],
    verificationStatus: providerStatusToVerification(input.provider),
    lastVerifiedAt: `${input.provider} discovery`,
    jamaat: FALLBACK_JAMAAT,
    jumuah: [],
    source,
    providerSources: [source],
    discoveryQuality: input.quality ?? "medium",
    providerConfidence: input.providerConfidence,
    providerUrl: input.providerUrl,
    providerDistanceMeters: input.providerDistanceMeters,
    coordinatesApproximate: input.coordinatesApproximate,
    googlePlaceId: input.googlePlaceId,
    googleMapsUri: input.googleMapsUri,
    mapplsELoc: input.mapplsELoc,
    foursquareId: input.foursquareId,
    notes: input.notes ?? "Discovered by an external provider. Confirm the exact mosque pin before navigation. Jamaat timings remain unknown until verified locally."
  };
}

const GENERIC_NAME_WORDS = /\b(unnamed|masjid|mosque|jamia|jama|jami|juma|jumma|jummah|musalla|musallah|musholla|islamic|muslim|center|centre|pallivasal|eidgah|idgah|prayer|room|hall|markaz|society|foundation)\b/g;

function normalizedName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(GENERIC_NAME_WORDS, " ")
    .replace(/[^a-z0-9\u0600-\u06ff\u0900-\u097f\u0b80-\u0bff]+/g, "")
    .trim();
}

function rawNormalizedName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\u0900-\u097f\u0b80-\u0bff]+/g, "")
    .trim();
}

function isGenericMasjidName(value: string): boolean {
  const raw = rawNormalizedName(value);
  return /^(unnamed)?(masjid|mosque|jamia|jama|juma|jumma|jumamasjid|jamiamasjid|musalla|musallah|musholla|surau|eidgah|idgah|islamiccenter|islamiccentre|prayerroom|prayerhall|markaz)$/.test(raw);
}

function normalizedNameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(GENERIC_NAME_WORDS, " ")
    .replace(/[^a-z0-9\u0600-\u06ff\u0900-\u097f\u0b80-\u0bff]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function namesLikelySame(a: string, b: string): boolean {
  const nameA = normalizedName(a);
  const nameB = normalizedName(b);

  if (!nameA || !nameB) return false;
  if (nameA === nameB) return true;
  if (nameA.length >= 4 && nameB.length >= 4 && (nameA.includes(nameB) || nameB.includes(nameA))) return true;

  const tokensA = new Set(normalizedNameTokens(a));
  const tokensB = new Set(normalizedNameTokens(b));
  if (!tokensA.size || !tokensB.size) return false;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }

  const smallerSetSize = Math.min(tokensA.size, tokensB.size);
  return overlap >= Math.max(1, Math.ceil(smallerSetSize * 0.67));
}

function sourcePriority(masjid: Masjid): number {
  if (masjid.source === "firestore" || masjid.verificationStatus === "admin_verified") return 100;
  if (masjid.verificationStatus === "community_checked") return 90;
  if (masjid.source === "google_places") return 86;
  if (masjid.source === "mappls") return masjid.coordinatesApproximate ? 64 : 78;
  if (masjid.source === "foursquare") return 72;
  if (masjid.source === "openstreetmap" && masjid.discoveryQuality === "high") return 66;
  if (masjid.source === "openstreetmap" && masjid.osmConfidence === "named") return 58;
  if (masjid.source === "community_report") return 55;
  return 20;
}

function sameDefinedId(a?: string, b?: string): boolean {
  return Boolean(a && b && a === b);
}

function sameExternalProviderId(a: Masjid, b: Masjid): boolean {
  if (sameDefinedId(a.googlePlaceId, b.googlePlaceId)) return true;
  if (sameDefinedId(a.mapplsELoc, b.mapplsELoc)) return true;
  if (sameDefinedId(a.foursquareId, b.foursquareId)) return true;
  if (a.osm && b.osm && a.osm.type === b.osm.type && a.osm.id === b.osm.id) return true;
  return false;
}

export function isDuplicateMasjid(a: Masjid, b: Masjid): boolean {
  if (a.id === b.id) return true;
  if (sameExternalProviderId(a, b)) return true;

  const d = distanceKm(a.coordinates, b.coordinates);
  const hasApproximateCoordinates = Boolean(a.coordinatesApproximate || b.coordinatesApproximate);
  const coordinateMergeLimitKm = hasApproximateCoordinates ? 0.55 : 0.18;
  if (!Number.isFinite(d) || d > coordinateMergeLimitKm) return false;

  // Never merge by distance alone. Dense areas can have two separate masjids
  // inside 45m, and distance-only merging causes mixed names/addresses.
  const namesMatch = namesLikelySame(a.name, b.name);
  if (!namesMatch) return false;

  if (d <= 0.12) return true;

  // Allow a slightly wider match only when at least one source is stronger.
  return d <= 0.18 && Math.max(sourcePriority(a), sourcePriority(b)) >= 86;
}

function uniqueNotes(notes: Array<string | undefined>): string | undefined {
  const unique = Array.from(new Set(notes.filter(Boolean).map((note) => note!.trim()).filter(Boolean)));
  return unique.length ? unique.join(" | ") : undefined;
}

function uniqueSources(...items: Array<Masjid | undefined>): NonNullable<Masjid["providerSources"]> {
  const sources = new Set<NonNullable<Masjid["source"]>>();
  for (const item of items) {
    if (!item) continue;
    if (item.source) sources.add(item.source);
    for (const source of item.providerSources ?? []) sources.add(source);
  }
  return Array.from(sources);
}

function mergeMasjidRecord(existing: Masjid, next: Masjid): Masjid {
  const existingPriority = sourcePriority(existing);
  const nextPriority = sourcePriority(next);
  const primary = nextPriority > existingPriority || (nextPriority === existingPriority && next.name.length > existing.name.length) ? next : existing;
  const secondary = primary === next ? existing : next;
  const providerSources = uniqueSources(primary, secondary);
  const highestConfidence = Math.max(Number(primary.providerConfidence ?? 0), Number(secondary.providerConfidence ?? 0));

  return {
    ...primary,
    phone: primary.phone ?? secondary.phone,
    providerUrl: primary.providerUrl ?? secondary.providerUrl,
    googlePlaceId: primary.googlePlaceId ?? secondary.googlePlaceId,
    googleMapsUri: primary.googleMapsUri ?? secondary.googleMapsUri,
    mapplsELoc: primary.mapplsELoc ?? secondary.mapplsELoc,
    foursquareId: primary.foursquareId ?? secondary.foursquareId,
    providerDistanceMeters: primary.providerDistanceMeters ?? secondary.providerDistanceMeters,
    coordinatesApproximate: primary.coordinatesApproximate && !secondary.coordinatesApproximate ? primary.coordinatesApproximate : primary.coordinatesApproximate && secondary.coordinatesApproximate,
    osm: primary.osm ?? secondary.osm,
    osmConfidence: primary.osmConfidence ?? secondary.osmConfidence,
    providerSources,
    providerConfidence: highestConfidence || primary.providerConfidence || secondary.providerConfidence,
    notes: uniqueNotes([
      primary.notes,
      secondary.notes,
      providerSources.length > 1 ? `Matched by ${providerSources.join(" + ")}; shown once after provider fusion.` : undefined
    ])
  };
}

function providerAwareDistanceKm(reference: Coordinates, masjid: Masjid): number {
  if (masjid.coordinatesApproximate && typeof masjid.providerDistanceMeters === "number" && Number.isFinite(masjid.providerDistanceMeters)) {
    return masjid.providerDistanceMeters / 1000;
  }
  return distanceKm(reference, masjid.coordinates);
}

export function mergeProviderMasjids(lists: Masjid[][], reference?: Coordinates): Masjid[] {
  const merged: Masjid[] = [];

  for (const list of lists) {
    for (const masjid of list) {
      const duplicateIndex = merged.findIndex((item) => isDuplicateMasjid(item, masjid));
      if (duplicateIndex === -1) {
        merged.push(masjid);
        continue;
      }

      merged[duplicateIndex] = mergeMasjidRecord(merged[duplicateIndex], masjid);
    }
  }

  return merged.sort((a, b) => {
    if (reference) {
      const distanceDelta = providerAwareDistanceKm(reference, a) - providerAwareDistanceKm(reference, b);
      if (Math.abs(distanceDelta) > 0.035) return distanceDelta;
    }
    return sourcePriority(b) - sourcePriority(a);
  });
}

export function providerMessage(provider: DiscoveryProvider, enabled: boolean, count: number): string {
  if (!enabled) return `${provider} not configured`;
  return `${provider}: ${count} result${count === 1 ? "" : "s"}`;
}
