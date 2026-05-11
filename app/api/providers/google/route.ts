import { NextRequest, NextResponse } from "next/server";
import { fetchGooglePlacesMasjids } from "@/lib/providers/googlePlaces";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusKm = Number(request.nextUrl.searchParams.get("radiusKm") ?? "5");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ provider: "google_places", enabled: Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY), masjids: [], count: 0, error: "Missing valid lat/lng." }, { status: 400 });
  }

  const result = await fetchGooglePlacesMasjids({ lat, lng }, radiusKm);
  return NextResponse.json(result, { status: result.error ? 503 : 200 });
}
