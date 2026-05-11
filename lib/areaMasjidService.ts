import type { Coordinates, Masjid } from "@/types";

export type AreaMasjidSearchResponse = {
  masjids: Masjid[];
  count: number;
  message?: string;
  diagnostics?: string[];
};

export async function searchAreaMasjids(query: string, center?: Coordinates, radiusKm = 50): Promise<AreaMasjidSearchResponse> {
  const params = new URLSearchParams({ q: query, radiusKm: String(radiusKm) });
  if (center) {
    params.set("lat", String(center.lat));
    params.set("lng", String(center.lng));
  }

  const response = await fetch(`/api/area-masjids?${params.toString()}`);
  const data = (await response.json()) as AreaMasjidSearchResponse;
  if (!response.ok) throw new Error(data.message || `Area masjid search failed (${response.status}).`);
  return data;
}
