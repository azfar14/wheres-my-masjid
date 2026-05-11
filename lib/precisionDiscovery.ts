"use client";

import type { Coordinates, Masjid } from "@/types";
import { mergeMasjidSources, type OsmNearbyApiResponse } from "@/lib/osmMasjidService";
import { mergeProviderMasjids, type DiscoveryProvider, type ProviderMasjidResponse } from "@/lib/providers/common";

export type PrecisionProviderResult = ProviderMasjidResponse & {
  label: string;
};

export type PrecisionDiscoveryResult = {
  masjids: Masjid[];
  providerResults: PrecisionProviderResult[];
  coverageGrade: "excellent" | "good" | "partial" | "thin";
  message: string;
  diagnostics: string[];
  errors: string[];
};

const PRIMARY_PROVIDER_TIMEOUT_MS = 9500;
const OSM_FALLBACK_TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 1000 * 60 * 25;
const FAST_SUCCESS_THRESHOLD = 5;
const QUICK_OSM_GRACE_MS = 2200;

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function cacheKeyFor(location: Coordinates, radiusKm: number): string {
  return `wmm:precision:${location.lat.toFixed(4)},${location.lng.toFixed(4)}:${radiusKm}`;
}

function readCached(location: Coordinates, radiusKm: number): PrecisionDiscoveryResult | undefined {
  if (!hasSessionStorage()) return undefined;
  try {
    const raw = window.sessionStorage.getItem(cacheKeyFor(location, radiusKm));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { expiresAt: number; result: PrecisionDiscoveryResult };
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(cacheKeyFor(location, radiusKm));
      return undefined;
    }
    return {
      ...parsed.result,
      providerResults: parsed.result.providerResults.map((provider) => ({ ...provider, cached: true })),
      diagnostics: ["Loaded nearby discovery from fast session cache.", ...parsed.result.diagnostics]
    };
  } catch {
    return undefined;
  }
}

function writeCached(location: Coordinates, radiusKm: number, result: PrecisionDiscoveryResult): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(
      cacheKeyFor(location, radiusKm),
      JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, result })
    );
  } catch {
    // Ignore quota/security failures. The cache is a performance optimization only.
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizedProvider(provider: DiscoveryProvider | "google" | "mappls" | "foursquare"): DiscoveryProvider {
  return provider === "google" ? "google_places" : provider;
}

function providerLabel(provider: DiscoveryProvider): string {
  if (provider === "google_places") return "Google Places";
  if (provider === "mappls") return "Mappls India";
  if (provider === "foursquare") return "Foursquare Global";
  if (provider === "openstreetmap") return "OpenStreetMap";
  if (provider === "nominatim") return "Nominatim";
  return provider;
}

async function fetchProvider(provider: "google" | "mappls" | "foursquare", location: Coordinates, radiusKm: number): Promise<PrecisionProviderResult> {
  const params = new URLSearchParams({ lat: String(location.lat), lng: String(location.lng), radiusKm: String(radiusKm) });
  try {
    const response = await fetchWithTimeout(`/api/providers/${provider}?${params.toString()}`, PRIMARY_PROVIDER_TIMEOUT_MS);
    const data = (await response.json()) as ProviderMasjidResponse;
    if (!response.ok && data.error) {
      return { ...data, label: providerLabel(normalizedProvider(data.provider ?? provider)) };
    }
    return { ...data, label: providerLabel(normalizedProvider(data.provider ?? provider)) };
  } catch (error) {
    return {
      provider: normalizedProvider(provider),
      label: providerLabel(normalizedProvider(provider)),
      enabled: true,
      masjids: [],
      count: 0,
      error: error instanceof Error ? error.message : `${providerLabel(normalizedProvider(provider))} search failed.`
    };
  }
}

function skippedOsmResult(reason: string): PrecisionProviderResult {
  return {
    provider: "openstreetmap",
    label: "OpenStreetMap / Overpass",
    enabled: true,
    masjids: [],
    count: 0,
    cached: false,
    message: reason,
    diagnostics: [reason]
  };
}

async function fetchOsm(location: Coordinates, radiusKm: number): Promise<PrecisionProviderResult[]> {
  const params = new URLSearchParams({ lat: String(location.lat), lng: String(location.lng), radiusKm: String(radiusKm) });
  try {
    const response = await fetchWithTimeout(`/api/osm-masjids?${params.toString()}`, OSM_FALLBACK_TIMEOUT_MS);
    const data = (await response.json()) as OsmNearbyApiResponse;
    const masjids = Array.isArray(data.masjids) ? data.masjids : [];
    const overpass: PrecisionProviderResult = {
      provider: "openstreetmap",
      label: "OpenStreetMap / Overpass",
      enabled: true,
      masjids,
      count: data.overpassCount ?? masjids.length,
      cached: Boolean((data as { cached?: boolean }).cached),
      message: data.message,
      error: response.ok ? undefined : data.message ?? `OSM failed (${response.status})`,
      diagnostics: data.diagnostics,
    };
    return [overpass];
  } catch (error) {
    return [{
      provider: "openstreetmap",
      label: "OpenStreetMap / Overpass",
      enabled: true,
      masjids: [],
      count: 0,
      error: error instanceof Error ? error.message : "OpenStreetMap search timed out or failed.",
      diagnostics: ["OSM fallback is optional. Foursquare/verified Firestore results can still power the public list."]
    }];
  }
}


async function waitForOptionalOsm(
  osmPromise: Promise<PrecisionProviderResult[]>,
  graceMs: number
): Promise<{ ready: true; value: PrecisionProviderResult[] } | { ready: false }> {
  return Promise.race([
    osmPromise.then((value) => ({ ready: true as const, value })),
    new Promise<{ ready: false }>((resolve) => window.setTimeout(() => resolve({ ready: false }), graceMs))
  ]);
}

function acceptedCount(providerResults: PrecisionProviderResult[]): number {
  return mergeProviderMasjids(providerResults.map((item) => item.masjids ?? [])).length;
}

function buildResult(location: Coordinates, radiusKm: number, providerResults: PrecisionProviderResult[]): PrecisionDiscoveryResult {
  const enabledProviders = providerResults.filter((item) => item.enabled && !item.error && (item.masjids?.length ?? 0) > 0);
  const merged = mergeProviderMasjids(providerResults.map((item) => item.masjids ?? []), location);
  const masjids = mergeMasjidSources([], merged, location);
  const coverageGrade = gradeCoverage(masjids.length, enabledProviders.length, radiusKm);
  const errors = providerResults.map((item) => item.error).filter((item): item is string => Boolean(item));
  const diagnostics = providerResults.flatMap((item) => [
    `${item.label}: ${item.enabled ? `${item.count} result${item.count === 1 ? "" : "s"}` : "not configured"}${item.cached ? " · cached" : ""}`,
    ...(item.diagnostics ?? [])
  ]);

  const message = masjids.length
    ? `Precision Engine found ${masjids.length} listing${masjids.length === 1 ? "" : "s"} from ${enabledProviders.length || 1} provider layer${enabledProviders.length === 1 ? "" : "s"}. Coverage: ${coverageGrade}.`
    : "No provider found a nearby masjid in this radius. Search exact name/area, expand radius, or report the exact pin so it becomes verified Firestore data.";

  return { masjids, providerResults, coverageGrade, message, diagnostics, errors };
}

function gradeCoverage(count: number, providerCount: number, radiusKm: number): PrecisionDiscoveryResult["coverageGrade"] {
  if (count >= 8 && providerCount >= 2) return "excellent";
  if (count >= 5 || (radiusKm <= 2 && count >= 2)) return "good";
  if (count >= 2) return "partial";
  return "thin";
}

export async function discoverPrecisionMasjids(location: Coordinates, radiusKm = 5): Promise<PrecisionDiscoveryResult> {
  const cached = readCached(location, radiusKm);
  if (cached) return cached;

  // Provider Fusion mode:
  // Google Places, Mappls, and Foursquare are ALWAYS queried together.
  // A strong result from Foursquare never suppresses Mappls; a strong result
  // from Mappls never suppresses Foursquare. Only slow OSM/Overpass is time-boxed
  // because it can delay the user-facing page by 20+ seconds.
  const osmPromise = fetchOsm(location, radiusKm);
  const primarySettled = await Promise.allSettled([
    fetchProvider("google", location, radiusKm),
    fetchProvider("mappls", location, radiusKm),
    fetchProvider("foursquare", location, radiusKm),
  ]);

  const primaryResults = primarySettled.map((result, index): PrecisionProviderResult => {
    if (result.status === "fulfilled") return result.value;
    const provider = (["google", "mappls", "foursquare"] as const)[index];
    return {
      provider: normalizedProvider(provider),
      label: providerLabel(normalizedProvider(provider)),
      enabled: true,
      masjids: [],
      count: 0,
      error: result.reason instanceof Error ? result.reason.message : "Provider failed."
    };
  });

  const fastCount = acceptedCount(primaryResults);
  if (fastCount >= FAST_SUCCESS_THRESHOLD) {
    const optionalOsm = await waitForOptionalOsm(osmPromise, QUICK_OSM_GRACE_MS);
    const result = buildResult(location, radiusKm, [
      ...primaryResults,
      ...(optionalOsm.ready
        ? optionalOsm.value
        : [skippedOsmResult(`Time-boxed OSM fallback after primary providers already returned ${fastCount} accepted listings. Mappls/Foursquare/Google were all queried; only slow OSM was skipped to keep results fast.`)])
    ]);
    result.diagnostics.unshift("Provider Fusion: Google Places, Mappls, and Foursquare were all queried in parallel. Common listings are deduped, not repeated.");
    if (!optionalOsm.ready) result.diagnostics.unshift("Fast mode: OSM was allowed a short grace window, but the page did not wait for slow Overpass.");
    writeCached(location, radiusKm, result);
    return result;
  }

  const osmResults = await osmPromise;
  const result = buildResult(location, radiusKm, [...primaryResults, ...osmResults]);
  result.diagnostics.unshift("Provider Fusion: Google Places, Mappls, Foursquare, and OSM were queried. Common listings are deduped, not repeated.");
  writeCached(location, radiusKm, result);
  return result;
}
