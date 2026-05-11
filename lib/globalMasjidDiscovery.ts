"use client";

import type { Coordinates, Masjid } from "@/types";
import { fetchNearbyOsmMasjids, mergeMasjidSources, type OsmNearbyApiResponse } from "@/lib/osmMasjidService";

export type GlobalDiscoveryResult = {
  masjids: Masjid[];
  messages: string[];
  errors: string[];
  noPaidApi: true;
  osmCount: number;
  overpassCount: number;
  nominatimCount: number;
  providerLabel: string;
  diagnostics: string[];
  coverageGrade?: "good" | "partial" | "thin";
};

async function fetchRaw(location: Coordinates, radiusKm: number): Promise<OsmNearbyApiResponse> {
  const params = new URLSearchParams({
    lat: String(location.lat),
    lng: String(location.lng),
    radiusKm: String(radiusKm)
  });

  const response = await fetch(`/api/osm-masjids?${params.toString()}`);
  const data = (await response.json()) as OsmNearbyApiResponse;
  if (!response.ok) {
    throw new Error(data.message || `OpenStreetMap search failed (${response.status}).`);
  }
  return data;
}

export async function discoverGlobalMasjids(location: Coordinates, radiusKm = 5): Promise<GlobalDiscoveryResult> {
  const messages: string[] = ["No paid Google Places API used. Discovery is powered by OpenStreetMap search plus your verified Firestore database."];
  const errors: string[] = [];
  let osmMasjids: Masjid[] = [];
  let overpassCount = 0;
  let nominatimCount = 0;
  let diagnostics: string[] = [];
  let coverageGrade: "good" | "partial" | "thin" | undefined;

  try {
    const result = await fetchRaw(location, radiusKm);
    osmMasjids = Array.isArray(result.masjids) ? result.masjids : [];
    overpassCount = result.overpassCount ?? 0;
    nominatimCount = result.nominatimCount ?? 0;
    diagnostics = result.diagnostics ?? [];
    coverageGrade = result.coverageGrade;
    if (result.message) messages.push(result.message);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "OpenStreetMap search failed.");
    try {
      osmMasjids = await fetchNearbyOsmMasjids(location, radiusKm);
    } catch {
      // fallback already reported above
    }
  }

  const masjids = mergeMasjidSources([], osmMasjids, location);

  return {
    masjids,
    messages,
    errors,
    noPaidApi: true,
    osmCount: osmMasjids.length,
    overpassCount,
    nominatimCount,
    providerLabel: "OpenStreetMap + Nominatim",
    diagnostics,
    coverageGrade
  };
}
