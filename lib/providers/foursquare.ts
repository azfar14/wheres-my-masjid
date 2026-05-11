import type { Coordinates, Masjid } from "@/types";
import { distanceKm } from "@/lib/geo";
import {
  buildExternalMasjid,
  clampRadiusKm,
  looksLikeMasjidText,
  mergeProviderMasjids,
  providerMessage,
  timeoutSignal,
  type ProviderMasjidResponse
} from "@/lib/providers/common";

// Foursquare has moved newer Service API Key traffic to the places-api host.
// Keep this overrideable so the app can survive future endpoint changes without
// changing client code.
const FOURSQUARE_ENDPOINT = process.env.FOURSQUARE_ENDPOINT || "https://places-api.foursquare.com/places/search";
const FOURSQUARE_API_VERSION = process.env.FOURSQUARE_API_VERSION || "2025-06-17";
const REQUEST_TIMEOUT_MS = 8500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

type CacheEntry = { expiresAt: number; value: ProviderMasjidResponse };
type QueryResult = { accepted: Masjid[]; rawCount: number };
const cache = new Map<string, CacheEntry>();

type FsCategory = { id?: number | string; name?: string; short_name?: string; plural_name?: string };
type FsPlace = {
  id?: string;
  fsq_id?: string;
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  geocodes?: {
    main?: { latitude?: number; longitude?: number };
    roof?: { latitude?: number; longitude?: number };
    drop_off?: { latitude?: number; longitude?: number };
  };
  geo?: { center?: { latitude?: number; longitude?: number } };
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    postcode?: string;
    latitude?: number;
    longitude?: number;
  };
  categories?: FsCategory[];
  distance?: number;
  link?: string;
  website?: string;
  tel?: string;
  telephone?: string;
};

type FsResponse = {
  results?: FsPlace[];
  places?: FsPlace[];
  data?: { results?: FsPlace[]; places?: FsPlace[] } | FsPlace[];
  context?: unknown;
  message?: string;
  error?: string;
};

function keyFor(location: Coordinates, radiusKm: number): string {
  return `${location.lat.toFixed(4)},${location.lng.toFixed(4)}:${radiusKm}`;
}

function finiteNumber(...values: Array<number | string | undefined>): number | undefined {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseCoordinates(place: FsPlace): Coordinates | undefined {
  // Prefer the building/pin coordinate when Foursquare provides it. The old
  // order used the broad "main" coordinate first, which can be less accurate
  // for navigation in dense areas.
  const lat = finiteNumber(
    place.geocodes?.roof?.latitude,
    place.geocodes?.main?.latitude,
    place.geocodes?.drop_off?.latitude,
    place.geo?.center?.latitude,
    place.location?.latitude,
    place.latitude,
    place.lat
  );
  const lng = finiteNumber(
    place.geocodes?.roof?.longitude,
    place.geocodes?.main?.longitude,
    place.geocodes?.drop_off?.longitude,
    place.geo?.center?.longitude,
    place.location?.longitude,
    place.longitude,
    place.lon
  );
  if (lat === undefined || lng === undefined) return undefined;
  return { lat, lng };
}

function placeId(place: FsPlace, coordinates: Coordinates): string {
  return place.fsq_id || place.fsq_place_id || place.id || `${place.name ?? "foursquare"}-${coordinates.lat}-${coordinates.lng}`;
}

function categoryTextFor(place: FsPlace): string {
  return (place.categories ?? [])
    .map((category) => [category.name, category.short_name, category.plural_name, category.id].filter(Boolean).join(" "))
    .join(" ");
}

function hasBadPoiCategory(place: FsPlace): boolean {
  const text = categoryTextFor(place).toLowerCase();
  // A query like “mosque” can still occasionally return unrelated streets,
  // restaurants, hotels, or stores. Keep the filter generous for Islamic names,
  // but block obvious non-worship categories unless the name itself is strongly
  // masjid-like.
  const name = (place.name ?? "").toLowerCase();
  const strongName = looksLikeMasjidText(name);
  if (strongName) return false;
  return /restaurant|hotel|motel|cafe|coffee|shop|store|mall|market|bus|train|rail|street|road|route|parking/i.test(text);
}

function isFoursquareMasjidCandidate(place: FsPlace, query: string): boolean {
  const categoryText = categoryTextFor(place);
  const searchable = [place.name, place.location?.formatted_address, place.location?.address, categoryText].filter(Boolean).join(" ");
  if (looksLikeMasjidText(searchable)) return true;

  // Foursquare’s new Places API sometimes labels mosque listings as broad
  // religious/spiritual/community categories while the name is local, such as
  // “TNTJ Markaz”. If the user/provider query itself is mosque/masjid related,
  // accept broad religious categories unless they are obviously non-worship POIs.
  const queryLooksIslamic = looksLikeMasjidText(query);
  const broadReligiousCategory = /religious|spiritual|place of worship|worship|community center|community centre/i.test(categoryText);
  return queryLooksIslamic && broadReligiousCategory && !hasBadPoiCategory(place);
}

function toMasjid(place: FsPlace, query: string): Masjid | undefined {
  const coordinates = parseCoordinates(place);
  if (!coordinates) return undefined;
  if (!isFoursquareMasjidCandidate(place, query)) return undefined;

  const address = place.location?.formatted_address || [place.location?.address, place.location?.locality, place.location?.region, place.location?.country, place.location?.postcode]
    .filter(Boolean)
    .join(", ");
  const id = placeId(place, coordinates);
  const providerUrl = place.link
    ? (place.link.startsWith("http") ? place.link : `https://foursquare.com${place.link}`)
    : place.website;
  return buildExternalMasjid({
    provider: "foursquare",
    externalId: id,
    name: place.name ?? "Masjid discovered by Foursquare",
    address,
    locality: place.location?.locality || place.location?.region || undefined,
    coordinates,
    phone: place.tel || place.telephone,
    providerUrl,
    foursquareId: id,
    quality: looksLikeMasjidText(`${place.name ?? ""} ${categoryTextFor(place)}`) ? "high" : "medium",
    providerConfidence: looksLikeMasjidText(`${place.name ?? ""} ${categoryTextFor(place)}`) ? 78 : 66,
    notes: "Discovered by Foursquare Places. Confirm the exact mosque pin before navigation; jamaat timings remain unknown until local/admin verification."
  });
}

async function readJsonSafely(response: Response): Promise<FsResponse> {
  const text = await response.text();
  if (!text.trim()) {
    return { results: [], message: `Foursquare returned an empty response (${response.status}). Check quota/access for Places API.` };
  }
  try {
    return JSON.parse(text) as FsResponse;
  } catch {
    return { results: [], message: `Foursquare returned non-JSON response (${response.status}): ${text.slice(0, 140)}` };
  }
}

function extractPlaces(data: FsResponse): FsPlace[] {
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.places)) return data.places;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && Array.isArray(data.data.results)) return data.data.results;
  if (data.data && Array.isArray(data.data.places)) return data.data.places;
  return [];
}

function authHeaders(apiKey: string, mode: "bearer" | "raw"): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: mode === "bearer" ? `Bearer ${apiKey}` : apiKey,
    "X-Places-Api-Version": FOURSQUARE_API_VERSION,
    "User-Agent": "WheresMyMasjid/provider-rescue Foursquare"
  };
}

async function fetchQueryWithMode(apiKey: string, location: Coordinates, radiusKm: number, query: string, mode: "bearer" | "raw"): Promise<QueryResult> {
  const radius = Math.min(100000, Math.max(300, Math.round(clampRadiusKm(radiusKm, 50) * 1000)));
  const params = new URLSearchParams({
    query,
    ll: `${location.lat},${location.lng}`,
    radius: String(radius),
    limit: "50",
    sort: "DISTANCE"
    // Do not send fields here. The newer Foursquare Places endpoint rejects some
    // legacy fields such as fsq_id. Default/core fields are enough for discovery.
  });

  const { signal, cancel } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${FOURSQUARE_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: authHeaders(apiKey, mode),
      signal
    });
    const data = await readJsonSafely(response);
    // The new Foursquare Service API can return X-RateLimit-Limit: 0 while still
    // returning a valid 200 OK body. Do NOT reject successful responses based on
    // that header; the previous build dropped real mosque results for this reason.
    if (!response.ok) throw new Error(data.message || data.error || `Foursquare returned ${response.status}`);
    const raw = extractPlaces(data);
    return {
      rawCount: raw.length,
      accepted: raw.map((place) => toMasjid(place, query)).filter((item): item is Masjid => Boolean(item))
    };
  } finally {
    cancel();
  }
}

async function fetchQuery(apiKey: string, location: Coordinates, radiusKm: number, query: string): Promise<QueryResult> {
  const preferredMode = (process.env.FOURSQUARE_AUTH_MODE || "bearer").toLowerCase() === "raw" ? "raw" : "bearer";
  try {
    return await fetchQueryWithMode(apiKey, location, radiusKm, query, preferredMode);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const canRetry = message.includes("invalid request token") || message.includes("401") || message.includes("403");
    if (!canRetry) throw error;
    const fallbackMode = preferredMode === "bearer" ? "raw" : "bearer";
    return fetchQueryWithMode(apiKey, location, radiusKm, query, fallbackMode);
  }
}

export async function fetchFoursquareMasjids(location: Coordinates, radiusKm = 5): Promise<ProviderMasjidResponse> {
  const started = Date.now();
  const apiKey = process.env.FOURSQUARE_API_KEY || process.env.FSQ_API_KEY;
  if (!apiKey) {
    return {
      provider: "foursquare",
      enabled: false,
      masjids: [],
      count: 0,
      message: "Foursquare is not configured. Add FOURSQUARE_API_KEY for stronger worldwide POI discovery."
    };
  }

  const radius = clampRadiusKm(radiusKm, 50);
  const key = keyFor(location, radius);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  const terms = ["mosque", "masjid", "islamic center", "islamic centre", "muslim prayer", "musalla", "prayer room", "pallivasal", "musholla", "surau", "jumma masjid", "jamia masjid", "markaz", "eidgah"];
  const keywordResults = await Promise.allSettled(terms.map((term) => fetchQuery(apiKey, location, radius, term)));
  const masjids = mergeProviderMasjids(keywordResults.map((result) => (result.status === "fulfilled" ? result.value.accepted : [])), location)
    .filter((masjid) => distanceKm(location, masjid.coordinates) <= radius + 0.05)
    .slice(0, 100);
  const failed = keywordResults.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
  const diagnostics = keywordResults.map((result, index) => {
    if (result.status === "fulfilled") return `${terms[index]}: ${result.value.accepted.length} accepted / ${result.value.rawCount} raw`;
    return `${terms[index]}: ${result.reason instanceof Error ? result.reason.message : "failed"}`;
  });

  const value: ProviderMasjidResponse = {
    provider: "foursquare",
    enabled: true,
    masjids,
    count: masjids.length,
    message: providerMessage("foursquare", true, masjids.length),
    diagnostics,
    error: masjids.length === 0 && failed.length === keywordResults.length ? (failed[0].reason instanceof Error ? failed[0].reason.message : "Foursquare search failed.") : undefined,
    durationMs: Date.now() - started
  };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
