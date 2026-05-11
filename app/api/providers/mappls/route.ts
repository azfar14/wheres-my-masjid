import { NextRequest, NextResponse } from "next/server";
import { fetchMapplsMasjids } from "@/lib/providers/mappls";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const radiusKm = Number(request.nextUrl.searchParams.get("radiusKm") ?? "5");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ provider: "mappls", enabled: Boolean(process.env.MAPPLS_ACCESS_TOKEN || process.env.MAPPLS_REST_KEY || process.env.MAPPLS_STATIC_KEY || process.env.MAPMYINDIA_ACCESS_TOKEN || process.env.MAPMYINDIA_REST_KEY || process.env.MAPMYINDIA_STATIC_KEY || process.env.MAPPLS_CLIENT_ID || process.env.MAPMYINDIA_CLIENT_ID), masjids: [], count: 0, error: "Missing valid lat/lng." }, { status: 400 });
  }

  const result = await fetchMapplsMasjids({ lat, lng }, radiusKm);
  return NextResponse.json(result, { status: result.error ? 503 : 200 });
}
