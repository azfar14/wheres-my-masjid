import type { Coordinates, OsmReference } from "@/types";

export type PlaceBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type PlaceSearchResult = {
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

type PlaceSearchApiResponse = {
  results: PlaceSearchResult[];
  message?: string;
};

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) throw new Error("Type a city, area, address, railway station, or landmark.");

  const response = await fetch(`/api/place-search?q=${encodeURIComponent(trimmed)}`);
  const data = (await response.json()) as PlaceSearchApiResponse;

  if (!response.ok) throw new Error(data.message || `Place search failed (${response.status}).`);
  if (!Array.isArray(data.results) || !data.results.length) throw new Error(data.message || "No matching place found. Try adding city, state, or country.");

  return data.results;
}
