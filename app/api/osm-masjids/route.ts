import { NextRequest, NextResponse } from "next/server";
import type { Coordinates, Masjid } from "@/types";
import { distanceKm } from "@/lib/geo";
import {
  MOSQUE_NAME_REGEX,
  nominatimItemToMasjid,
  osmElementToMasjid,
  type NominatimSearchItem,
  type OverpassElement
} from "@/lib/osmMasjidParser";

export const dynamic = "force-dynamic";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter"
];

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 11000;
const OVERPASS_TIMEOUT_SECONDS = 9;
const MAX_RESULTS = 220;
const CACHE_TTL_MS = 1000 * 60 * 30;
const NOMINATIM_TERMS = ["mosque", "masjid", "jumma masjid", "jamia masjid", "pallivasal", "musalla", "islamic center", "islamic centre"];

type OverpassResponse = {
  elements?: OverpassElement[];
  remark?: string;
};

type CacheEntry = {
  expiresAt: number;
  value: {
    masjids: Masjid[];
    radiusKm: number;
    overpassCount: number;
    nominatimCount: number;
    endpoint?: string;
    diagnostics: string[];
    coverageGrade: "good" | "partial" | "thin";
  };
};

const cache = new Map<string, CacheEntry>();

function cacheKey(location: Coordinates, radiusKm: number): string {
  return `${location.lat.toFixed(4)},${location.lng.toFixed(4)}:${radiusKm}`;
}

function clampRadius(radiusKm: number): number {
  if (!Number.isFinite(radiusKm)) return 5;
  return Math.min(25, Math.max(0.3, Number(radiusKm.toFixed(1))));
}

function radiusMeters(radiusKm: number): number {
  return Math.round(clampRadius(radiusKm) * 1000);
}

function escapedRegexForOverpass(): string {
  return MOSQUE_NAME_REGEX.replace(/"/g, "");
}

function buildReliableOverpassQuery(location: Coordinates, radiusKm: number): string {
  const radius = radiusMeters(radiusKm);
  const broadRadius = radiusMeters(Math.min(radiusKm, 6));
  const lat = location.lat.toFixed(6);
  const lng = location.lng.toFixed(6);
  const keyword = escapedRegexForOverpass();

  // One compact query is much more reliable than several long queries that can
  // time out before the browser receives any results. The parser still filters
  // out commercial/non-masjid objects after this query returns.
  return `
[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
(
  nwr["amenity"="place_of_worship"]["religion"~"muslim|islam|islamic",i](around:${radius},${lat},${lng});
  nwr["amenity"="place_of_worship"]["denomination"~"muslim|islam|sunni|shia|shiite|sufi",i](around:${radius},${lat},${lng});
  nwr["religion"~"muslim|islam|islamic",i](around:${radius},${lat},${lng});
  nwr["denomination"~"muslim|islam|sunni|shia|shiite|sufi",i](around:${radius},${lat},${lng});
  nwr["building"~"mosque|masjid|musalla|musallah|mussalla|musholla|surau|pallivasal|palli",i](around:${radius},${lat},${lng});
  nwr["building:use"~"mosque|masjid|musalla|musallah|mussalla|musholla|surau|pallivasal|palli",i](around:${radius},${lat},${lng});
  nwr["place_of_worship"~"mosque|masjid|muslim|islam|prayer",i](around:${radius},${lat},${lng});
  nwr["historic"~"mosque|masjid",i](around:${radius},${lat},${lng});
  nwr["landuse"="religious"]["religion"~"muslim|islam",i](around:${radius},${lat},${lng});
  nwr["amenity"="prayer_room"]["religion"~"muslim|islam",i](around:${radius},${lat},${lng});
  nwr["amenity"="community_centre"]["religion"~"muslim|islam",i](around:${radius},${lat},${lng});
  nwr[~"^(name|name:.*|official_name|alt_name|old_name|short_name|operator|contact:organisation|description|note|alt_name:.*)$"~"${keyword}",i](around:${radius},${lat},${lng});
  nwr["amenity"="place_of_worship"](around:${broadRadius},${lat},${lng});
);
out tags center ${MAX_RESULTS};
`;
}

function qualityRank(masjid: Masjid): number {
  if (masjid.source === "firestore" || masjid.verificationStatus === "admin_verified") return 100;
  if (masjid.discoveryQuality === "high") return 75;
  if (masjid.discoveryQuality === "medium") return 50;
  if (masjid.osmConfidence === "named") return 45;
  if (masjid.osmConfidence === "possible") return 30;
  return 10;
}

function dedupeMasjids(masjids: Masjid[], reference: Coordinates, radiusKm: number): Masjid[] {
  const byKey = new Map<string, Masjid>();

  for (const masjid of masjids) {
    if (distanceKm(reference, masjid.coordinates) > radiusKm + 0.2) continue;
    const rounded = `${masjid.coordinates.lat.toFixed(5)},${masjid.coordinates.lng.toFixed(5)}`;
    const key = masjid.osm ? `${masjid.osm.type}-${masjid.osm.id}` : rounded;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, masjid);
      continue;
    }

    const existingQuality = qualityRank(existing);
    const nextQuality = qualityRank(masjid);
    if (nextQuality > existingQuality || (nextQuality === existingQuality && masjid.name.length > existing.name.length)) {
      byKey.set(key, masjid);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => {
      const distanceDelta = distanceKm(reference, a.coordinates) - distanceKm(reference, b.coordinates);
      if (Math.abs(distanceDelta) > 0.04) return distanceDelta;
      return qualityRank(b) - qualityRank(a);
    })
    .slice(0, MAX_RESULTS);
}

async function postOverpass(endpoint: string, query: string): Promise<{ endpoint: string; response: OverpassResponse }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "WheresMyMasjid/reliable-nearby-engine"
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`Overpass ${new URL(endpoint).host} returned ${response.status}`);
    const data = (await response.json()) as OverpassResponse;
    if (data.remark) throw new Error(data.remark);
    return { endpoint, response: data };
  } finally {
    clearTimeout(timeout);
  }
}

function viewboxFor(location: Coordinates, radiusKm: number): string {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos((location.lat * Math.PI) / 180)));
  const left = location.lng - lngDelta;
  const right = location.lng + lngDelta;
  const top = location.lat + latDelta;
  const bottom = location.lat - latDelta;
  return `${left},${top},${right},${bottom}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNominatimTerm(term: string, location: Coordinates, radiusKm: number): Promise<Masjid[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      q: term,
      limit: "15",
      addressdetails: "1",
      extratags: "1",
      namedetails: "1",
      bounded: "1",
      viewbox: viewboxFor(location, Math.min(radiusKm, 8)),
      dedupe: "1"
    });

    if (process.env.NOMINATIM_EMAIL) params.set("email", process.env.NOMINATIM_EMAIL);

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent": "WheresMyMasjid/reliable-nearby-engine",
        "Accept-Language": "en"
      },
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`Nominatim ${term} returned ${response.status}`);
    const data = (await response.json()) as NominatimSearchItem[];
    return data
      .map(nominatimItemToMasjid)
      .filter((masjid): masjid is Masjid => Boolean(masjid))
      .filter((masjid) => distanceKm(location, masjid.coordinates) <= radiusKm + 0.2);
  } finally {
    clearTimeout(timeout);
  }
}

function simplifyError(error: unknown, radiusKm: number): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("abort") || lower.includes("timeout") || lower.includes("timed out") || lower.includes("runtime error")) {
    return `timed out at ${radiusKm} km`;
  }
  if (lower.includes("429") || lower.includes("too many")) return "rate limited";
  return message || "search failed";
}

async function runOverpassDiscovery(location: Coordinates, radiusKm: number): Promise<{ masjids: Masjid[]; endpoint?: string; diagnostics: string[] }> {
  const query = buildReliableOverpassQuery(location, radiusKm);
  const settled = await Promise.allSettled(OVERPASS_ENDPOINTS.map((endpoint) => postOverpass(endpoint, query)));
  const diagnostics: string[] = [];
  const combined: Masjid[] = [];
  let endpoint: string | undefined;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      endpoint = endpoint ?? result.value.endpoint;
      const found = (result.value.response.elements ?? [])
        .map(osmElementToMasjid)
        .filter((masjid): masjid is Masjid => Boolean(masjid))
        .filter((masjid) => distanceKm(location, masjid.coordinates) <= radiusKm + 0.2);
      combined.push(...found);
      diagnostics.push(`${new URL(result.value.endpoint).host}: ${found.length}`);
    } else {
      diagnostics.push(`Overpass endpoint: ${simplifyError(result.reason, radiusKm)}`);
    }
  }

  return { masjids: dedupeMasjids(combined, location, radiusKm), endpoint, diagnostics };
}

async function fetchNominatimPois(location: Coordinates, radiusKm: number): Promise<{ masjids: Masjid[]; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  const combined: Masjid[] = [];

  for (let index = 0; index < NOMINATIM_TERMS.length; index += 1) {
    if (index > 0) await sleep(1100);
    const term = NOMINATIM_TERMS[index];
    try {
      const results = await fetchNominatimTerm(term, location, Math.min(radiusKm, 8));
      combined.push(...results);
      diagnostics.push(`Nominatim ${term}: ${results.length}`);
    } catch (error) {
      diagnostics.push(`Nominatim ${term}: ${simplifyError(error, radiusKm)}`);
    }
  }

  return { masjids: dedupeMasjids(combined, location, radiusKm), diagnostics };
}

function coverageGrade(count: number, radiusKm: number): "good" | "partial" | "thin" {
  if (count >= 8 || (radiusKm <= 2 && count >= 2)) return "good";
  if (count >= 2) return "partial";
  return "thin";
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusKm = clampRadius(Number(request.nextUrl.searchParams.get("radiusKm") ?? "5"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ masjids: [], message: "Missing valid lat/lng." }, { status: 400 });
  }

  const location = { lat, lng };
  const key = cacheKey(location, radiusKm);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.value, cached: true });
  }

  const diagnostics: string[] = [];
  const overpass = await runOverpassDiscovery(location, radiusKm);
  diagnostics.push(...overpass.diagnostics);

  let nominatim = { masjids: [] as Masjid[], diagnostics: [] as string[] };
  if (overpass.masjids.length < 3 && radiusKm <= 10) {
    nominatim = await fetchNominatimPois(location, radiusKm);
    diagnostics.push(...nominatim.diagnostics);
  }

  const masjids = dedupeMasjids([...overpass.masjids, ...nominatim.masjids], location, radiusKm);
  const value = {
    masjids,
    radiusKm,
    overpassCount: overpass.masjids.length,
    nominatimCount: nominatim.masjids.length,
    endpoint: overpass.endpoint,
    diagnostics,
    coverageGrade: coverageGrade(masjids.length, radiusKm)
  };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });

  if (!masjids.length) {
    return NextResponse.json({
      ...value,
      message: "OpenStreetMap did not return nearby masjids from this coordinate. Use Mappls/Foursquare keys for stronger coverage, search exact area/name, or report the exact pin so it becomes verified Firestore data."
    });
  }

  return NextResponse.json(value);
}
