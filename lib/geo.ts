import type { Coordinates, Masjid } from "@/types";

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function cleanPart(value?: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isVerifiedCoordinateListing(masjid: Pick<Masjid, "verificationStatus" | "source" | "googlePlaceId">): boolean {
  return (
    masjid.verificationStatus === "admin_verified" ||
    masjid.verificationStatus === "community_checked" ||
    Boolean(masjid.googlePlaceId) ||
    masjid.source === "google_places"
  );
}

function isProviderDiscoveredListing(masjid: Pick<Masjid, "source" | "verificationStatus">): boolean {
  return (
    masjid.source === "foursquare" ||
    masjid.source === "mappls" ||
    masjid.source === "openstreetmap" ||
    masjid.verificationStatus === "foursquare_discovered" ||
    masjid.verificationStatus === "mappls_discovered" ||
    masjid.verificationStatus === "osm_discovered"
  );
}

function masjidGoogleQuery(masjid: Pick<Masjid, "name" | "address" | "locality" | "coordinates">): string {
  const name = cleanPart(masjid.name);
  const address = cleanPart(masjid.address);
  const locality = cleanPart(masjid.locality);
  const base = [name, locality, address]
    .filter(Boolean)
    .filter((part, index, list) => list.indexOf(part) === index)
    .join(" ");

  return `${base} mosque masjid`.replace(/\s+/g, " ").trim() || `${masjid.coordinates.lat},${masjid.coordinates.lng}`;
}

export function distanceKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function displayDistanceKm(origin: Coordinates | undefined, masjid: Pick<Masjid, "coordinates" | "providerDistanceMeters" | "coordinatesApproximate">): number | undefined {
  if (masjid.coordinatesApproximate && typeof masjid.providerDistanceMeters === "number" && Number.isFinite(masjid.providerDistanceMeters)) {
    return masjid.providerDistanceMeters / 1000;
  }
  if (!origin) return undefined;
  return distanceKm(origin, masjid.coordinates);
}

export function formatDistance(km?: number): string {
  if (km === undefined) return "Distance unknown";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function walkingMinutes(km?: number): number | undefined {
  if (km === undefined) return undefined;
  return Math.max(1, Math.round((km / 4.8) * 60));
}

export function bikeMinutes(km?: number): number | undefined {
  if (km === undefined) return undefined;
  return Math.max(1, Math.round((km / 18) * 60));
}

export function directionsUrl(to: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=walking`;
}

export function googleMapsNearbyMasjidSearchUrl(center: Coordinates): string {
  return `https://www.google.com/maps/search/mosque+masjid/@${center.lat},${center.lng},15z`;
}

export function googleMapsSearchUrlForMasjid(masjid: Pick<Masjid, "name" | "address" | "locality" | "coordinates" | "googlePlaceId">): string {
  const params = new URLSearchParams({
    api: "1",
    query: masjidGoogleQuery(masjid)
  });
  if (masjid.googlePlaceId) params.set("query_place_id", masjid.googlePlaceId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function exactCoordinateSearchUrl(to: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${to.lat},${to.lng}`;
}

export function openStreetMapPinUrl(to: Coordinates, zoom = 18): string {
  return `https://www.openstreetmap.org/?mlat=${to.lat}&mlon=${to.lng}#map=${zoom}/${to.lat}/${to.lng}`;
}

export function openStreetMapNearbySearchUrl(center: Coordinates): string {
  return `https://www.openstreetmap.org/search?query=mosque%20masjid#map=15/${center.lat}/${center.lng}`;
}

export function openStreetMapObjectUrl(masjid: Pick<Masjid, "osm" | "coordinates">): string {
  if (masjid.osm) return `https://www.openstreetmap.org/${masjid.osm.type}/${masjid.osm.id}`;
  return openStreetMapPinUrl(masjid.coordinates);
}

export function openStreetMapDirectionsUrl(from: Coordinates, to: Coordinates): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${from.lat}%2C${from.lng}%3B${to.lat}%2C${to.lng}`;
}

export function mapplsPinUrl(pin: string): string {
  return `https://mappls.com/${encode(pin)}`;
}

export function mapplsDirectionsUrl(from: Coordinates | undefined, to: Coordinates, mapplsPin?: string): string {
  const destination = mapplsPin ? encode(mapplsPin) : `${to.lat},${to.lng}`;
  if (!from) return mapplsPin ? mapplsPinUrl(mapplsPin) : `https://mappls.com/${to.lat},${to.lng}`;
  return `https://mappls.com/direction?places=${from.lat},${from.lng};${destination}`;
}

export function exactMapUrlForMasjid(masjid: Pick<Masjid, "name" | "address" | "locality" | "coordinates" | "source" | "osm" | "googlePlaceId" | "googleMapsUri" | "providerUrl" | "mapplsELoc" | "verificationStatus">): string {
  // User-facing verification for external listings should prefer Google Maps text/place search.
  // Raw provider pins are useful for debugging, but can be shifted to a nearby house/building.
  if (isProviderDiscoveredListing(masjid) && !isVerifiedCoordinateListing(masjid)) return googleMapsSearchUrlForMasjid(masjid);

  if (masjid.source === "mappls" && masjid.mapplsELoc) return mapplsPinUrl(masjid.mapplsELoc);
  if (masjid.providerUrl) return masjid.providerUrl;

  if (masjid.googlePlaceId) return googleMapsSearchUrlForMasjid(masjid);

  if (masjid.googleMapsUri) return masjid.googleMapsUri;
  if (masjid.source === "openstreetmap" || masjid.osm) return openStreetMapObjectUrl(masjid);

  return exactCoordinateSearchUrl(masjid.coordinates);
}

export function providerRawPinUrlForMasjid(masjid: Pick<Masjid, "name" | "coordinates" | "source" | "osm" | "googlePlaceId" | "googleMapsUri" | "providerUrl" | "mapplsELoc">): string {
  if (masjid.source === "mappls" && masjid.mapplsELoc) return mapplsPinUrl(masjid.mapplsELoc);
  if (masjid.providerUrl) return masjid.providerUrl;
  if (masjid.googlePlaceId) return `https://www.google.com/maps/search/?api=1&query=${encode(masjid.name)}&query_place_id=${encode(masjid.googlePlaceId)}`;
  if (masjid.googleMapsUri) return masjid.googleMapsUri;
  if (masjid.source === "openstreetmap" || masjid.osm) return openStreetMapObjectUrl(masjid);
  return exactCoordinateSearchUrl(masjid.coordinates);
}

export function googleMapsDirectionsUrl(from: Coordinates | undefined, to: Coordinates): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${to.lat},${to.lng}`,
    travelmode: "walking",
    dir_action: "navigate"
  });

  // For actual turn-by-turn navigation, it is usually better not to force a
  // stale origin. Google Maps can use the phone's live location and continue
  // tracking the user after the Maps app opens. The origin is only used in
  // desktop/browser route preview links.
  if (from && typeof window !== "undefined" && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    params.set("origin", `${from.lat},${from.lng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsDirectionsByQueryUrl(origin: Coordinates | undefined, destinationQuery: string, placeId?: string): string {
  const params = new URLSearchParams({
    api: "1",
    destination: destinationQuery,
    travelmode: "walking",
    dir_action: "navigate"
  });

  if (placeId) params.set("destination_place_id", placeId);

  // On phones, allow Google Maps to use live current location so turn-by-turn continues normally.
  if (origin && typeof window !== "undefined" && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function directionsUrlForMasjid(
  masjid: Pick<Masjid, "name" | "address" | "locality" | "coordinates" | "source" | "osm" | "googlePlaceId" | "googleMapsUri" | "providerUrl" | "mapplsELoc" | "verificationStatus">,
  origin?: Coordinates
): string {
  if (masjid.googlePlaceId) return googleMapsDirectionsByQueryUrl(origin, masjidGoogleQuery(masjid), masjid.googlePlaceId);
  if (isVerifiedCoordinateListing(masjid)) return googleMapsDirectionsUrl(origin, masjid.coordinates);

  // Navigation lock: never launch turn-by-turn directly to an unverified external coordinate.
  // Provider POI pins can be shifted. Open Google Maps search first so the user selects the real mosque listing.
  if (isProviderDiscoveredListing(masjid)) return googleMapsSearchUrlForMasjid(masjid);

  return googleMapsDirectionsUrl(origin, masjid.coordinates);
}

export function navigationSafetyLabel(masjid: Pick<Masjid, "verificationStatus" | "source" | "googlePlaceId">): string {
  if (isVerifiedCoordinateListing(masjid)) return "Direct verified navigation";
  if (isProviderDiscoveredListing(masjid)) return "Verify in Google Maps first";
  return "Coordinate navigation";
}
