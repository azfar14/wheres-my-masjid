import { NextRequest, NextResponse } from "next/server";
import { osmElementToMasjid, type OverpassElement } from "@/lib/osmMasjidParser";

export const dynamic = "force-dynamic";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter"
];

const REQUEST_TIMEOUT_MS = 9000;

type OverpassResponse = { elements?: OverpassElement[]; remark?: string };

function validType(value: string | null): value is "node" | "way" | "relation" {
  return value === "node" || value === "way" || value === "relation";
}

async function fetchObject(endpoint: string, type: "node" | "way" | "relation", id: number): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const query = `
[out:json][timeout:8];
${type}(${id});
out tags center;
`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "WheresMyMasjidMVP/osm-object-import"
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`OpenStreetMap object fetch failed (${response.status}).`);
    const data = (await response.json()) as OverpassResponse;
    if (data.remark) throw new Error(data.remark);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const id = Number(request.nextUrl.searchParams.get("id"));

  if (!validType(type) || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ message: "Paste a valid OpenStreetMap node, way, or relation URL." }, { status: 400 });
  }

  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchObject(endpoint, type, id);
      const element = data.elements?.[0];
      if (!element) return NextResponse.json({ message: "OpenStreetMap object was not found." }, { status: 404 });
      const masjid = osmElementToMasjid(element);
      if (!masjid) {
        return NextResponse.json(
          { message: "That OpenStreetMap object does not look like a mosque/masjid. Check the OSM tags or submit it as a missing report." },
          { status: 422 }
        );
      }
      return NextResponse.json({ masjid, endpoint });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Could not fetch OSM object.");
    }
  }

  return NextResponse.json({ message: errors[0] || "Could not fetch that OpenStreetMap object." }, { status: 503 });
}
