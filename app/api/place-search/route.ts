import { NextRequest, NextResponse } from "next/server";
import type { Coordinates, OsmReference } from "@/types";

export const dynamic = "force-dynamic";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 9000;
const CACHE_TTL_MS = 1000 * 60 * 60;
const MIN_SPACING_MS = 1100;

let lastRequestAt = 0;
const cache = new Map<string, { expiresAt: number; value: PlaceSearchResult[] }>();

type PlaceBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

type PlaceSearchResult = {
  id: string;
  name: string;
  displayName: string;
  coordinates: Coordinates;
  category?: string;
  osm?: OsmReference;
  bounds?: PlaceBounds;
  areaRadiusKm?: number;
  isBroadArea?: boolean;
};

type NominatimResult = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  address?: Record<string, string>;
  boundingbox?: [string, string, string, string] | string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactName(result: NominatimResult): string {
  const address = result.address ?? {};
  return (
    result.name ||
    address.neighbourhood ||
    address.suburb ||
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state ||
    result.display_name?.split(",")[0]?.trim() ||
    "Selected place"
  );
}


function parseBounds(result: NominatimResult): PlaceBounds | undefined {
  const box = result.boundingbox;
  if (!Array.isArray(box) || box.length < 4) return undefined;
  const south = Number(box[0]);
  const north = Number(box[1]);
  const west = Number(box[2]);
  const east = Number(box[3]);
  if (![south, north, west, east].every(Number.isFinite)) return undefined;
  return { south, north, west, east };
}

function estimateRadiusKm(bounds: PlaceBounds | undefined): number | undefined {
  if (!bounds) return undefined;
  const latKm = Math.abs(bounds.north - bounds.south) * 111;
  const midLat = (bounds.north + bounds.south) / 2;
  const lngKm = Math.abs(bounds.east - bounds.west) * 111 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const diagonal = Math.sqrt(latKm * latKm + lngKm * lngKm);
  if (!Number.isFinite(diagonal) || diagonal <= 0) return undefined;
  return Number((diagonal / 2).toFixed(1));
}

function parseOsmReference(result: NominatimResult): OsmReference | undefined {
  const id = Number(result.osm_id);
  if (!Number.isFinite(id)) return undefined;
  if (result.osm_type === "node" || result.osm_type === "N") return { type: "node", id };
  if (result.osm_type === "way" || result.osm_type === "W") return { type: "way", id };
  if (result.osm_type === "relation" || result.osm_type === "R") return { type: "relation", id };
  return undefined;
}

function parseResult(result: NominatimResult): PlaceSearchResult | undefined {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

  const osm = parseOsmReference(result);
  const stableId = result.place_id ? String(result.place_id) : `${result.osm_type ?? "place"}-${result.osm_id ?? `${lat},${lng}`}`;
  const bounds = parseBounds(result);
  const areaRadiusKm = estimateRadiusKm(bounds);
  const category = [result.class, result.type].filter(Boolean).join(" / ") || undefined;
  const isBroadArea = Boolean(areaRadiusKm && areaRadiusKm > 12) || /boundary|administrative|state|county|region/i.test(category ?? "");

  return {
    id: stableId,
    name: compactName(result),
    displayName: result.display_name ?? compactName(result),
    coordinates: { lat, lng },
    category,
    osm,
    bounds,
    areaRadiusKm,
    isBroadArea
  };
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [], message: "Type a city, area, address, railway station, or landmark." }, { status: 400 });
  }

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ results: cached.value, cached: true });
  }

  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_SPACING_MS) await sleep(MIN_SPACING_MS - sinceLast);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      q,
      limit: "5",
      addressdetails: "1",
      dedupe: "1"
    });

    if (process.env.NOMINATIM_EMAIL) params.set("email", process.env.NOMINATIM_EMAIL);

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: {
        "User-Agent": "WheresMyMasjidMVP/0.2 no-paid-api",
        "Accept-Language": "en"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return NextResponse.json({ results: [], message: `Place search failed (${response.status}). Try a more specific place name.` }, { status: response.status });
    }

    const data = (await response.json()) as NominatimResult[];
    const results = data.map(parseResult).filter((item): item is PlaceSearchResult => Boolean(item));
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: results });

    if (!results.length) return NextResponse.json({ results: [], message: "No matching place found. Try adding city, state, or country." }, { status: 404 });
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Place search took too long. Try a more specific area name."
      : error instanceof Error
        ? error.message
        : "Place search failed. Try again.";
    return NextResponse.json({ results: [], message }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
