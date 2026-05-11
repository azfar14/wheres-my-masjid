import { NextRequest, NextResponse } from "next/server";
import type { Coordinates, Masjid } from "@/types";
import { distanceKm } from "@/lib/geo";
import { fetchGooglePlacesMasjids } from "@/lib/providers/googlePlaces";
import { fetchMapplsMasjids } from "@/lib/providers/mappls";
import { fetchFoursquareMasjids } from "@/lib/providers/foursquare";
import { isLikelyIndiaOrNeighbour, type DiscoveryProvider, type ProviderMasjidResponse } from "@/lib/providers/common";
import { hasVerifiedTimings, isLowConfidenceListing, timingTrustLabel } from "@/lib/verification";
import { calculateTrustScore } from "@/lib/trustScore";
import { evaluateJamaatReach, smartRankScore } from "@/lib/smartRanking";

export const dynamic = "force-dynamic";

type OsmApiResponse = {
  masjids?: Masjid[];
  message?: string;
  diagnostics?: string[];
  overpassCount?: number;
  nominatimCount?: number;
  endpoint?: string;
  cached?: boolean;
};

type AcceptedListing = {
  id: string;
  name: string;
  source?: string;
  verificationStatus: string;
  distanceKm: number;
  distanceMeters: number;
  trustScore: number;
  trustLabel: string;
  timingStatus: string;
  quality?: string;
  confidence?: number;
  reason: string;
  coordinates: Coordinates;
  exactPin?: string;
  reachHeadline?: string;
  reachDetail?: string;
  smartRankScore?: number;
};

type ProviderDebugBlock = {
  id: DiscoveryProvider;
  label: string;
  configured: boolean;
  enabled: boolean;
  count: number;
  durationMs?: number;
  status: "ready" | "not-configured" | "skipped" | "error";
  message?: string;
  error?: string;
  diagnostics: string[];
  accepted: AcceptedListing[];
};

const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 5;

function clampRadius(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RADIUS_KM;
  return Math.min(MAX_RADIUS_KM, Math.max(0.3, Number(value.toFixed(1))));
}

function finiteCoordinate(lat: number, lng: number): Coordinates | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

function sourcePriority(masjid: Masjid): number {
  if (masjid.source === "firestore" || masjid.verificationStatus === "admin_verified") return 100;
  if (masjid.verificationStatus === "community_checked") return 90;
  if (masjid.source === "google_places") return 88;
  if (masjid.source === "mappls") return 82;
  if (masjid.source === "foursquare") return 75;
  if (masjid.source === "openstreetmap" && masjid.discoveryQuality === "high") return 66;
  if (masjid.source === "openstreetmap" && masjid.osmConfidence === "named") return 58;
  if (masjid.source === "community_report") return 52;
  return 20;
}

function reasonFor(masjid: Masjid): string {
  if (hasVerifiedTimings(masjid)) return "accepted: verified jamaat timings are available";
  if (masjid.source === "google_places") return "accepted: Google Places mosque result; timing still needs local verification";
  if (masjid.source === "mappls") return "accepted: Mappls India POI/category result; timing still needs local verification";
  if (masjid.source === "foursquare") return "accepted: Foursquare global POI result; timing still needs local verification";
  if (masjid.source === "openstreetmap" && masjid.discoveryQuality === "high") return "accepted: strong OpenStreetMap mosque/place-of-worship tags";
  if (masjid.source === "openstreetmap" && masjid.osmConfidence === "named") return "accepted: named OpenStreetMap mosque-like listing";
  if (masjid.source === "openstreetmap") return "accepted with caution: weak/unnamed OpenStreetMap pin";
  return "accepted: provider returned a location-like masjid listing";
}

function exactPin(masjid: Masjid): string | undefined {
  if (masjid.providerUrl) return masjid.providerUrl;
  if (masjid.source === "openstreetmap" && masjid.osm) return `https://www.openstreetmap.org/${masjid.osm.type}/${masjid.osm.id}`;
  return `https://www.google.com/maps/search/?api=1&query=${masjid.coordinates.lat},${masjid.coordinates.lng}`;
}

function acceptedListings(masjids: Masjid[], center: Coordinates, radiusKm: number): AcceptedListing[] {
  return masjids
    .map((masjid) => {
      const d = distanceKm(center, masjid.coordinates);
      const trust = calculateTrustScore(masjid);
      const reach = evaluateJamaatReach(masjid, d);
      const rankScore = smartRankScore(masjid, d);
      return { masjid, d, trust, reach, rankScore };
    })
    .filter(({ d }) => d <= radiusKm + 0.25)
    .sort((a, b) => {
      const distanceDelta = a.d - b.d;
      if (Math.abs(distanceDelta) > 0.035) return distanceDelta;
      return sourcePriority(b.masjid) - sourcePriority(a.masjid);
    })
    .slice(0, 80)
    .map(({ masjid, d, trust, reach, rankScore }) => ({
      id: masjid.id,
      name: masjid.name,
      source: masjid.source,
      verificationStatus: masjid.verificationStatus,
      distanceKm: Number(d.toFixed(3)),
      distanceMeters: Math.round(d * 1000),
      trustScore: trust.score,
      trustLabel: trust.label,
      timingStatus: timingTrustLabel(masjid),
      quality: masjid.discoveryQuality,
      confidence: masjid.providerConfidence,
      reason: reasonFor(masjid),
      coordinates: masjid.coordinates,
      exactPin: exactPin(masjid),
      reachHeadline: reach.headline,
      reachDetail: reach.detail,
      smartRankScore: rankScore,
    }));
}

function providerBlockFromResponse(label: string, response: ProviderMasjidResponse, center: Coordinates, radiusKm: number): ProviderDebugBlock {
  return {
    id: response.provider,
    label,
    configured: response.enabled,
    enabled: response.enabled,
    count: response.count,
    durationMs: response.durationMs,
    status: !response.enabled ? "not-configured" : response.error ? "error" : response.count === 0 ? "skipped" : "ready",
    message: response.message,
    error: response.error,
    diagnostics: response.diagnostics ?? [],
    accepted: acceptedListings(response.masjids ?? [], center, radiusKm),
  };
}

async function fetchOsm(origin: string, center: Coordinates, radiusKm: number): Promise<ProviderDebugBlock> {
  const started = Date.now();
  const params = new URLSearchParams({ lat: String(center.lat), lng: String(center.lng), radiusKm: String(radiusKm) });
  try {
    const response = await fetch(`${origin}/api/osm-masjids?${params.toString()}`, { headers: { "User-Agent": "WheresMyMasjid/production-qa-debug" } });
    const data = (await response.json()) as OsmApiResponse;
    const masjids = Array.isArray(data.masjids) ? data.masjids : [];
    return {
      id: "openstreetmap",
      label: "OpenStreetMap / Overpass + Nominatim",
      configured: true,
      enabled: true,
      count: masjids.length,
      durationMs: Date.now() - started,
      status: response.ok ? (masjids.length ? "ready" : "skipped") : "error",
      message: data.message,
      error: response.ok ? undefined : data.message ?? `OSM returned ${response.status}`,
      diagnostics: [
        ...(data.endpoint ? [`endpoint: ${data.endpoint}`] : []),
        `overpass: ${data.overpassCount ?? 0}`,
        `nominatim: ${data.nominatimCount ?? 0}`,
        ...(data.diagnostics ?? []),
      ],
      accepted: acceptedListings(masjids, center, radiusKm),
    };
  } catch (error) {
    return {
      id: "openstreetmap",
      label: "OpenStreetMap / Overpass + Nominatim",
      configured: true,
      enabled: true,
      count: 0,
      durationMs: Date.now() - started,
      status: "error",
      error: error instanceof Error ? error.message : "OSM debug search failed.",
      diagnostics: [],
      accepted: [],
    };
  }
}

function noResultsAdvice(blocks: ProviderDebugBlock[], center: Coordinates): string[] {
  const advice: string[] = [];
  const hasGoogle = blocks.some((block) => block.id === "google_places" && block.configured);
  const hasMappls = blocks.some((block) => block.id === "mappls" && block.configured);
  const hasFoursquare = blocks.some((block) => block.id === "foursquare" && block.configured);
  const total = blocks.reduce((sum, block) => sum + block.accepted.length, 0);

  if (total > 0) {
    advice.push("Results exist. If the public nearby page is empty, check radius/filter settings or browser cached code.");
    return advice;
  }

  if (!hasGoogle) {
    advice.push("Google Maps shows nearby mosques only through Google Places data. Add GOOGLE_PLACES_API_KEY if you want those exact Google Maps POIs inside the app.");
  }
  if (isLikelyIndiaOrNeighbour(center) && !hasMappls) {
    advice.push("India search point detected: configure MAPPLS_ACCESS_TOKEN or MAPPLS_STATIC_KEY to improve nearby mosque coverage.");
  }
  if (!hasFoursquare) {
    advice.push("Configure FOURSQUARE_API_KEY for worldwide POI coverage beyond OpenStreetMap.");
  }
  advice.push("Open the no-key external Maps/OSM search links from /nearby to confirm whether the masjid exists in map data.");
  advice.push("If the masjid exists externally but not in the app, paste its OSM link in /nearby or submit /missing with an exact pin so Firestore becomes the trusted source.");
  advice.push("For a user-facing launch, seed verified Firestore listings around your target city so the app does not depend only on external POI providers.");
  return advice;
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusKm = clampRadius(Number(request.nextUrl.searchParams.get("radiusKm") ?? DEFAULT_RADIUS_KM));
  const center = finiteCoordinate(lat, lng);

  if (!center) {
    return NextResponse.json({ error: "Provide valid lat and lng query parameters." }, { status: 400 });
  }

  const started = Date.now();
  const [googlePlaces, mappls, foursquare] = await Promise.all([
    fetchGooglePlacesMasjids(center, radiusKm),
    fetchMapplsMasjids(center, radiusKm),
    fetchFoursquareMasjids(center, radiusKm),
  ]);

  const primaryBlocks: ProviderDebugBlock[] = [
    providerBlockFromResponse("Google Places", googlePlaces, center, radiusKm),
    providerBlockFromResponse("Mappls India", mappls, center, radiusKm),
    providerBlockFromResponse("Foursquare Global", foursquare, center, radiusKm),
  ];
  const primaryAcceptedCount = primaryBlocks.reduce((sum, block) => sum + block.accepted.length, 0);
  const osm = primaryAcceptedCount >= 5
    ? {
        id: "openstreetmap" as const,
        label: "OpenStreetMap / Overpass + Nominatim",
        configured: true,
        enabled: true,
        count: 0,
        durationMs: 0,
        status: "skipped" as const,
        message: `Skipped slow OSM fallback because primary providers already returned ${primaryAcceptedCount} accepted listings.`,
        diagnostics: ["Fast QA mode: Foursquare/primary providers were enough, so Overpass was not called."],
        accepted: [],
      }
    : await fetchOsm(request.nextUrl.origin, center, radiusKm);

  const blocks: ProviderDebugBlock[] = [
    ...primaryBlocks,
    osm,
  ];

  const finalCandidates = blocks.flatMap((block) => block.accepted.map((item) => ({ ...item, provider: block.label })));
  finalCandidates.sort((a, b) => {
    const scoreDelta = (b.smartRankScore ?? 0) - (a.smartRankScore ?? 0);
    if (Math.abs(scoreDelta) > 8) return scoreDelta;
    const distanceDelta = a.distanceKm - b.distanceKm;
    if (Math.abs(distanceDelta) > 0.035) return distanceDelta;
    return b.trustScore - a.trustScore;
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    searchCenter: center,
    radiusKm,
    durationMs: Date.now() - started,
    providerCascade: blocks,
    finalCount: finalCandidates.length,
    finalCandidates: finalCandidates.slice(0, 100),
    advice: noResultsAdvice(blocks, center),
    launchGate: {
      ready: finalCandidates.length >= 3 || blocks.some((block) => (block.id === "google_places" || block.id === "mappls") && block.count >= 3),
      summary: finalCandidates.length >= 3
        ? "Nearby discovery returned enough candidates for this coordinate. Verify exact pins/timings before public launch."
        : "Nearby discovery is thin for this coordinate. Configure providers or add verified Firestore listings before sharing publicly.",
    },
  });
}
