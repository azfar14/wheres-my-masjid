import { NextRequest, NextResponse } from "next/server";
import type { Coordinates, Masjid } from "@/types";
import { distanceKm } from "@/lib/geo";
import { nominatimItemToMasjid, type NominatimSearchItem } from "@/lib/osmMasjidParser";
import { mergeProviderMasjids } from "@/lib/providers/common";

export const dynamic = "force-dynamic";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 11000;
const CACHE_TTL_MS = 1000 * 60 * 60;
const MIN_SPACING_MS = 1100;
const TERMS = ["mosque", "masjid", "jumma masjid", "jamia masjid", "pallivasal", "musalla", "islamic center", "islamic centre"];

let lastRequestAt = 0;
const cache = new Map<string, { expiresAt: number; value: { masjids: Masjid[]; count: number; diagnostics: string[]; message: string } }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(150, Math.max(2, Number(value.toFixed(1))));
}

async function respectNominatimSpacing() {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_SPACING_MS) await sleep(MIN_SPACING_MS - sinceLast);
  lastRequestAt = Date.now();
}

async function fetchTerm(term: string, area: string): Promise<Masjid[]> {
  await respectNominatimSpacing();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      q: `${term} ${area}`,
      limit: "12",
      addressdetails: "1",
      extratags: "1",
      namedetails: "1",
      dedupe: "1"
    });
    if (process.env.NOMINATIM_EMAIL) params.set("email", process.env.NOMINATIM_EMAIL);

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent": "WheresMyMasjid/area-masjid-search",
        "Accept-Language": "en"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    const data = (await response.json()) as NominatimSearchItem[];
    return data.map(nominatimItemToMasjid).filter((item): item is Masjid => Boolean(item));
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const center: Coordinates | undefined = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  const radiusKm = clampRadius(Number(request.nextUrl.searchParams.get("radiusKm") ?? "50"));

  if (q.length < 2) {
    return NextResponse.json({ masjids: [], count: 0, message: "Type a city, area, state, or exact masjid name." }, { status: 400 });
  }

  const key = `${q.toLowerCase()}:${center ? `${center.lat.toFixed(3)},${center.lng.toFixed(3)}` : "no-center"}:${radiusKm}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ ...cached.value, cached: true });

  const diagnostics: string[] = [];
  const collected: Masjid[] = [];
  for (const term of TERMS) {
    try {
      const results = await fetchTerm(term, q);
      diagnostics.push(`${term} ${q}: ${results.length}`);
      collected.push(...results);
    } catch (error) {
      diagnostics.push(`${term} ${q}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  const merged = mergeProviderMasjids([collected], center);
  const masjids = center
    ? merged.filter((masjid) => distanceKm(center, masjid.coordinates) <= radiusKm + 5).slice(0, 80)
    : merged.slice(0, 80);

  const value = {
    masjids,
    count: masjids.length,
    diagnostics,
    message: masjids.length
      ? `Area search found ${masjids.length} masjid candidate${masjids.length === 1 ? "" : "s"} for ${q}.`
      : `Area search did not find masjid candidates for ${q}. Try a more specific locality or report the exact pin.`
  };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return NextResponse.json(value);
}
