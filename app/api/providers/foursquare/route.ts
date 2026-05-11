import { NextRequest, NextResponse } from "next/server";
import { fetchFoursquareMasjids } from "@/lib/providers/foursquare";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusKm = Number(request.nextUrl.searchParams.get("radiusKm") ?? "5");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ provider: "foursquare", enabled: Boolean(process.env.FOURSQUARE_API_KEY || process.env.FSQ_API_KEY), masjids: [], count: 0, error: "Missing valid lat/lng." }, { status: 400 });
  }

  const result = await fetchFoursquareMasjids({ lat, lng }, radiusKm);
  return NextResponse.json(result, { status: result.error ? 503 : 200 });
}
