import type { Coordinates, Masjid } from "@/types";
import { buildExternalMasjid, clampRadiusKm, mergeProviderMasjids, providerMessage, timeoutSignal, type ProviderMasjidResponse } from "@/lib/providers/common";
import { distanceKm } from "@/lib/geo";

const GOOGLE_NEARBY_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const GOOGLE_TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const REQUEST_TIMEOUT_MS = 8500;
const CACHE_TTL_MS = 1000 * 60 * 60 * 3;
const MAX_GOOGLE_RADIUS_KM = 50;
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount"
].join(",");

type CacheEntry = { expiresAt: number; value: ProviderMasjidResponse };
const cache = new Map<string, CacheEntry>();

type GooglePlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
  error?: { code?: number; message?: string; status?: string };
};

function apiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
}

function keyFor(location: Coordinates, radiusKm: number): string {
  return `${location.lat.toFixed(4)},${location.lng.toFixed(4)}:${radiusKm}`;
}

function isMosquePlace(place: GooglePlace): boolean {
  const text = [place.primaryType, ...(place.types ?? []), place.displayName?.text, place.formattedAddress]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /mosque|masjid|musalla|islamic|pallivasal|jumma|jamia/.test(text);
}

function placeToMasjid(place: GooglePlace, origin: Coordinates): Masjid | undefined {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const coordinates = { lat: Number(lat), lng: Number(lng) };
  const name = place.displayName?.text?.trim();
  if (!name || !isMosquePlace(place)) return undefined;
  const address = place.formattedAddress ?? `${name} · ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
  const providerConfidence = Math.min(98, 72 + Math.min(20, (place.userRatingCount ?? 0) / 10) + (place.rating ? 6 : 0));

  return buildExternalMasjid({
    provider: "google_places",
    externalId: place.id ?? `${name}-${coordinates.lat}-${coordinates.lng}`,
    name,
    address,
    locality: address.split(",").slice(1, 3).join(",").trim() || "Nearby area",
    coordinates,
    providerUrl: place.googleMapsUri,
    googlePlaceId: place.id,
    googleMapsUri: place.googleMapsUri,
    quality: distanceKm(origin, coordinates) <= 0.08 ? "high" : "medium",
    providerConfidence,
    notes: "Discovered from Google Places. Use Google Place ID navigation where available; jamaat timings still need verification before countdowns."
  });
}

async function postGoogle(endpoint: string, body: unknown, key: string): Promise<GooglePlacesResponse> {
  const { signal, cancel } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK
      },
      body: JSON.stringify(body)
    });
    const data = (await response.json()) as GooglePlacesResponse;
    if (!response.ok) {
      throw new Error(data.error?.message ?? `Google Places returned ${response.status}`);
    }
    return data;
  } finally {
    cancel();
  }
}

async function fetchNearby(key: string, location: Coordinates, radiusKm: number): Promise<Masjid[]> {
  const radiusMeters = Math.max(300, Math.min(MAX_GOOGLE_RADIUS_KM * 1000, Math.round(radiusKm * 1000)));
  const data = await postGoogle(GOOGLE_NEARBY_ENDPOINT, {
    includedTypes: ["mosque"],
    maxResultCount: 20,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: radiusMeters
      }
    }
  }, key);
  return (data.places ?? []).map((place) => placeToMasjid(place, location)).filter((item): item is Masjid => Boolean(item));
}

async function fetchTextFallback(key: string, location: Coordinates, radiusKm: number): Promise<Masjid[]> {
  if (process.env.GOOGLE_PLACES_TEXT_FALLBACK !== "true") return [];
  const radiusMeters = Math.max(300, Math.min(MAX_GOOGLE_RADIUS_KM * 1000, Math.round(radiusKm * 1000)));
  const terms = ["mosque", "masjid"];
  const settled = await Promise.allSettled(terms.map((term) => postGoogle(GOOGLE_TEXT_ENDPOINT, {
    textQuery: `${term} near ${location.lat},${location.lng}`,
    maxResultCount: 12,
    locationBias: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: radiusMeters
      }
    }
  }, key)));
  return mergeProviderMasjids(settled.map((result) => result.status === "fulfilled"
    ? (result.value.places ?? []).map((place) => placeToMasjid(place, location)).filter((item): item is Masjid => Boolean(item))
    : []), location);
}

export async function fetchGooglePlacesMasjids(location: Coordinates, radiusKm = 5): Promise<ProviderMasjidResponse> {
  const started = Date.now();
  const key = apiKey();
  if (!key) {
    return {
      provider: "google_places",
      enabled: false,
      masjids: [],
      count: 0,
      message: "Google Places is not configured. Add GOOGLE_PLACES_API_KEY only if you want Google Maps-grade nearby mosque discovery."
    };
  }

  const radius = clampRadiusKm(radiusKm, MAX_GOOGLE_RADIUS_KM);
  const cacheKey = keyFor(location, radius);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  try {
    const nearby = await fetchNearby(key, location, radius);
    const fallback = nearby.length >= 3 ? [] : await fetchTextFallback(key, location, radius);
    const masjids = mergeProviderMasjids([nearby, fallback], location).filter((masjid) => distanceKm(location, masjid.coordinates) <= radius + 0.05).slice(0, 60);
    const value: ProviderMasjidResponse = {
      provider: "google_places",
      enabled: true,
      masjids,
      count: masjids.length,
      message: providerMessage("google_places", true, masjids.length),
      diagnostics: [
        `nearby mosque type: ${nearby.length}`,
        `text fallback: ${fallback.length}${process.env.GOOGLE_PLACES_TEXT_FALLBACK === "true" ? "" : " (disabled)"}`,
        "Google Places results are still unverified for jamaat timings until approved in Firestore."
      ],
      durationMs: Date.now() - started
    };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    return {
      provider: "google_places",
      enabled: true,
      masjids: [],
      count: 0,
      error: error instanceof Error ? error.message : "Google Places search failed.",
      durationMs: Date.now() - started
    };
  }
}
