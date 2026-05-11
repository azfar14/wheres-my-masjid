import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function configured(...names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name] && String(process.env[name]).trim()));
}

export async function GET() {
  const googlePlaces = configured("GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY");
  const mappls = configured("MAPPLS_ACCESS_TOKEN", "MAPPLS_REST_KEY", "MAPPLS_STATIC_KEY", "MAPMYINDIA_ACCESS_TOKEN", "MAPMYINDIA_REST_KEY", "MAPMYINDIA_STATIC_KEY") || (configured("MAPPLS_CLIENT_ID", "MAPMYINDIA_CLIENT_ID") && configured("MAPPLS_CLIENT_SECRET", "MAPMYINDIA_CLIENT_SECRET"));
  const foursquare = configured("FOURSQUARE_API_KEY", "FSQ_API_KEY");
  const nominatimEmail = configured("NOMINATIM_EMAIL");

  return NextResponse.json({
    providers: [
      {
        id: "firestore",
        label: "Firestore verified masjids",
        configured: true,
        role: "Trusted masjid database + jamaat timings",
        priority: 1,
      },
      {
        id: "google_places",
        label: "Google Places",
        configured: googlePlaces,
        role: "Optional highest-coverage Google Maps POI discovery",
        priority: 2,
        setupEnv: "GOOGLE_PLACES_API_KEY",
        advisory: googlePlaces ? "Google Places enabled; monitor billing/quota." : "Optional. Not required for no-key Google navigation."
      },
      {
        id: "mappls",
        label: "Mappls / MapmyIndia",
        configured: mappls,
        role: "India-first POI discovery",
        priority: 3,
        setupEnv: "MAPPLS_ACCESS_TOKEN / MAPPLS_REST_KEY / MAPPLS_STATIC_KEY, or OAuth client id/secret",
      },
      {
        id: "foursquare",
        label: "Foursquare Places",
        configured: foursquare,
        role: "Worldwide POI discovery",
        priority: 4,
        setupEnv: "FOURSQUARE_API_KEY",
      },
      {
        id: "openstreetmap",
        label: "OpenStreetMap / Overpass",
        configured: true,
        role: "Open fallback discovery + exact OSM object import",
        priority: 5,
      },
      {
        id: "nominatim",
        label: "Nominatim place search",
        configured: true,
        role: "City/area/landmark search fallback",
        priority: 6,
        advisory: nominatimEmail ? "Contact email configured" : "Add NOMINATIM_EMAIL before public traffic",
      },
    ],
    recommended: googlePlaces || mappls || foursquare
      ? "At least one premium provider layer is configured. External results are navigation-ready but jamaat timings still require verification."
      : "Add Mappls for India and Foursquare for global coverage. Add Google Places only if you need Google Maps-grade POI results and accept billing.",
  });
}
