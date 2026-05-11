import type { Coordinates, Masjid } from "@/types";
import { distanceKm } from "@/lib/geo";
import {
  buildExternalMasjid,
  clampRadiusKm,
  isLikelyIndiaOrNeighbour,
  looksLikeMasjidText,
  mergeProviderMasjids,
  providerMessage,
  timeoutSignal,
  type ProviderMasjidResponse
} from "@/lib/providers/common";

const MAPPLS_NEARBY_ENDPOINT = "https://search.mappls.com/search/places/nearby/json";
const MAPPLS_TOKEN_ENDPOINT = "https://outpost.mappls.com/api/security/oauth/token";
const MAX_RADIUS_M = 10000;
const REQUEST_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const ISLAMIC_CATEGORY_CODE = "PLPISL";

// Mappls/MapmyIndia is the primary India accuracy layer. It is optional, but
// without it Indian POI coverage falls back mostly to Firestore + OSM.
// Keep keys/tokens server-side only. Never use NEXT_PUBLIC_ for these credentials.

type CacheEntry = { expiresAt: number; value: ProviderMasjidResponse };
const cache = new Map<string, CacheEntry>();
let tokenCache: { token: string; tokenType: string; expiresAt: number } | undefined;

type MapplsTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type MapplsLocation = {
  eLoc?: string;
  mapplsPin?: string;
  placeName?: string;
  placeAddress?: string;
  latitude?: string | number;
  longitude?: string | number;
  lat?: string | number;
  lng?: string | number;
  lon?: string | number;
  placeLat?: string | number;
  placeLng?: string | number;
  entryLatitude?: string | number;
  entryLongitude?: string | number;
  distance?: string | number;
  type?: string;
  categoryCode?: string;
  keywords?: string[] | string;
  telNo?: string;
  mobileNo?: string;
  landlineNo?: string;
};

type MapplsResponse = {
  suggestedLocations?: MapplsLocation[];
  results?: MapplsLocation[];
  responseCode?: number;
  error?: string;
  message?: string;
  errorDescription?: string;
};

function keyFor(location: Coordinates, radiusKm: number): string {
  return `${location.lat.toFixed(4)},${location.lng.toFixed(4)}:${radiusKm}`;
}

function firstFiniteNumber(...values: Array<string | number | undefined>): number | undefined {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseCoordinates(item: MapplsLocation): Coordinates | undefined {
  const lat = firstFiniteNumber(item.latitude, item.lat, item.placeLat, item.entryLatitude);
  const lng = firstFiniteNumber(item.longitude, item.lng, item.lon, item.placeLng, item.entryLongitude);
  if (lat === undefined || lng === undefined) return undefined;
  return { lat, lng };
}

function mapplsPinFor(item: MapplsLocation): string | undefined {
  return item.eLoc || item.mapplsPin;
}

function isIslamicCategory(item: MapplsLocation): boolean {
  const text = [item.categoryCode, item.type, Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  return text.includes(ISLAMIC_CATEGORY_CODE) || /ISLAMIC|MOSQUE|MASJID|MUSALLA|PALLIVASAL/i.test(text);
}

function providerDistanceMeters(item: MapplsLocation): number | undefined {
  const value = firstFiniteNumber(item.distance);
  return value !== undefined && value >= 0 ? value : undefined;
}

function toMasjid(item: MapplsLocation, trustedCategory = false, reference?: Coordinates): Masjid | undefined {
  const parsedCoordinates = parseCoordinates(item);
  const pin = mapplsPinFor(item);

  // Mappls Nearby often returns excellent POI results with eLoc + distance but
  // without latitude/longitude in the nearby response. Do NOT throw those away.
  // Keep them as Mappls discovery candidates, show the Mappls-reported distance,
  // and route by Google/Mappls search confirmation until an admin verifies exact
  // coordinates. If Place Details/eLoc geocoding is enabled later, exact pins can
  // be upgraded without changing the public model.
  const distanceMeters = providerDistanceMeters(item);
  const coordinates = parsedCoordinates ?? reference;
  if (!coordinates) return undefined;

  const searchable = [item.placeName, item.placeAddress, item.type, item.categoryCode, Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords]
    .filter(Boolean)
    .join(" ");

  // When we query the official Islamic category code, accept results even if the
  // local display name is generic (“Masjid”, “Mosque”). Otherwise keep keyword checks.
  if (!trustedCategory && !isIslamicCategory(item) && !looksLikeMasjidText(searchable)) return undefined;

  const id = pin ?? `${item.placeName ?? "mappls"}-${coordinates.lat}-${coordinates.lng}`;
  const name = item.placeName?.trim() || (trustedCategory || isIslamicCategory(item) ? "Islamic prayer place" : "Masjid discovered by Mappls");
  const isApproximate = !parsedCoordinates;

  return buildExternalMasjid({
    provider: "mappls",
    externalId: id,
    name,
    address: item.placeAddress,
    locality: item.placeAddress?.split(",").slice(0, 2).join(","),
    coordinates,
    phone: item.telNo || item.mobileNo || item.landlineNo,
    providerUrl: pin ? `https://mappls.com/${pin}` : `https://mappls.com/${coordinates.lat},${coordinates.lng}`,
    mapplsELoc: pin,
    providerDistanceMeters: distanceMeters,
    coordinatesApproximate: isApproximate,
    quality: trustedCategory || isIslamicCategory(item) ? "high" : "medium",
    providerConfidence: trustedCategory || isIslamicCategory(item) ? (isApproximate ? 78 : 88) : (isApproximate ? 68 : 76),
    notes: isApproximate
      ? "Discovered by Mappls/MapmyIndia with eLoc + provider distance. Exact lat/lng was not returned by Nearby API, so users must confirm in Google/Mappls before navigation until admin verifies the pin."
      : "Discovered by Mappls/MapmyIndia. Confirm the exact mosque pin before navigation; jamaat timings remain unknown until local verification."
  });
}

async function getMapplsToken(): Promise<{ token: string; tokenType: string } | undefined> {
  const directToken =
    process.env.MAPPLS_ACCESS_TOKEN ||
    process.env.MAPPLS_REST_KEY ||
    process.env.MAPPLS_STATIC_KEY ||
    process.env.MAPPLS_API_KEY ||
    process.env.MAPMYINDIA_ACCESS_TOKEN ||
    process.env.MAPMYINDIA_REST_KEY ||
    process.env.MAPMYINDIA_STATIC_KEY ||
    process.env.MAPMYINDIA_API_KEY;
  if (directToken) return { token: directToken, tokenType: "static" };

  const clientId = process.env.MAPPLS_CLIENT_ID || process.env.MAPMYINDIA_CLIENT_ID;
  const clientSecret = process.env.MAPPLS_CLIENT_SECRET || process.env.MAPMYINDIA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return { token: tokenCache.token, tokenType: tokenCache.tokenType };
  }

  const { signal, cancel } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(MAPPLS_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "WheresMyMasjid/reliable-engine Mappls OAuth" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
      signal
    });
    const data = (await response.json()) as MapplsTokenResponse;
    if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || `Mappls token returned ${response.status}`);
    const tokenType = data.token_type || "Bearer";
    const expiresIn = Number(data.expires_in ?? 3600);
    tokenCache = { token: data.access_token, tokenType, expiresAt: Date.now() + Math.max(300, expiresIn - 120) * 1000 };
    return { token: data.access_token, tokenType };
  } finally {
    cancel();
  }
}

type MapplsRequestMode = "keyword" | "category-filter" | "category-keyword";

async function fetchMapplsRequest(
  auth: { token: string; tokenType: string },
  location: Coordinates,
  radiusKm: number,
  mode: MapplsRequestMode,
  value: string
): Promise<Masjid[]> {
  const radius = Math.min(MAX_RADIUS_M, Math.max(500, Math.round(clampRadiusKm(radiusKm, 10) * 1000)));
  const params = new URLSearchParams({
    refLocation: `${location.lat},${location.lng}`,
    radius: String(radius),
    sortBy: "dist:asc",
    region: "IND",
    page: "1"
  });

  if (mode === "category-filter") {
    params.set("keywords", ISLAMIC_CATEGORY_CODE);
    params.set("filter", `categoryCode:${value}`);
  } else {
    params.set("keywords", value);
  }

  // Mappls REST examples pass the static key as access_token. OAuth variants may
  // use Authorization; this server-side route sends both when possible.
  params.set("access_token", auth.token);

  const { signal, cancel } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "User-Agent": "WheresMyMasjid/reliable-engine Mappls"
    };
    if (auth.tokenType !== "static") headers.Authorization = `${auth.tokenType} ${auth.token}`;

    const response = await fetch(`${MAPPLS_NEARBY_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers,
      signal
    });
    const rawText = await response.text();
    let data: MapplsResponse = {};
    if (rawText.trim()) {
      try {
        data = JSON.parse(rawText) as MapplsResponse;
      } catch {
        throw new Error(`Mappls returned non-JSON response (${response.status}): ${rawText.slice(0, 140)}`);
      }
    } else {
      // Mappls commonly uses 204/empty responses for “no nearby suggestions”.
      // Treat that as zero results instead of poisoning the provider cascade.
      if (response.status === 204 || response.status === 200) return [];
      throw new Error(`Mappls returned an empty response (${response.status}). Check key type, Nearby API access, and key restrictions.`);
    }
    if (!response.ok || data.error) throw new Error(data.message || data.errorDescription || data.error || `Mappls returned ${response.status}`);
    const items = data.suggestedLocations ?? data.results ?? [];
    const trustedCategory = mode !== "keyword" || value.toUpperCase() === ISLAMIC_CATEGORY_CODE;
    return items.map((item) => toMasjid(item, trustedCategory, location)).filter((item): item is Masjid => Boolean(item));
  } finally {
    cancel();
  }
}

export async function fetchMapplsMasjids(location: Coordinates, radiusKm = 5): Promise<ProviderMasjidResponse> {
  const started = Date.now();
  let auth: { token: string; tokenType: string } | undefined;

  try {
    auth = await getMapplsToken();
  } catch (error) {
    return {
      provider: "mappls",
      enabled: true,
      masjids: [],
      count: 0,
      error: error instanceof Error ? error.message : "Mappls token/authentication failed.",
      diagnostics: ["Check Mappls API access, token type, and allowed services in the Mappls console."],
      durationMs: Date.now() - started
    };
  }

  if (!auth) {
    return {
      provider: "mappls",
      enabled: false,
      masjids: [],
      count: 0,
      message: "Mappls is not configured. Add MAPPLS_ACCESS_TOKEN / MAPPLS_STATIC_KEY for India-first nearby masjid discovery.",
      durationMs: Date.now() - started
    };
  }

  if (!isLikelyIndiaOrNeighbour(location)) {
    return {
      provider: "mappls",
      enabled: true,
      masjids: [],
      count: 0,
      message: "Mappls skipped because the search point is outside India/neighbouring-region bounds.",
      durationMs: Date.now() - started
    };
  }

  const radius = clampRadiusKm(radiusKm, 10);
  const key = keyFor(location, radius);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  const requests: Array<{ mode: MapplsRequestMode; value: string; label: string }> = [
    { mode: "category-keyword", value: ISLAMIC_CATEGORY_CODE, label: `keyword ${ISLAMIC_CATEGORY_CODE}` },
    ...["mosque", "masjid", "jumma masjid", "jamia masjid", "juma masjid", "pallivasal", "musalla", "eidgah", "islamic center", "islamic centre", "muslim prayer"].map((value) => ({ mode: "keyword" as const, value, label: value }))
  ];

  const settled = await Promise.allSettled(requests.map((request) => fetchMapplsRequest(auth, location, radius, request.mode, request.value)));
  const masjids = mergeProviderMasjids(settled.map((result) => (result.status === "fulfilled" ? result.value : [])), location)
    .filter((masjid) => {
      const d = masjid.coordinatesApproximate && typeof masjid.providerDistanceMeters === "number" ? masjid.providerDistanceMeters / 1000 : distanceKm(location, masjid.coordinates);
      return d <= radius + 0.05;
    })
    .slice(0, 100);
  const diagnostics = settled.map((result, index) => `${requests[index].label}: ${result.status === "fulfilled" ? result.value.length : result.reason instanceof Error ? result.reason.message : "failed"}`);

  const value: ProviderMasjidResponse = {
    provider: "mappls",
    enabled: true,
    masjids,
    count: masjids.length,
    message: providerMessage("mappls", true, masjids.length),
    diagnostics,
    durationMs: Date.now() - started
  };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
