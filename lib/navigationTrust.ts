import type { Coordinates, Masjid } from "@/types";

export type MasjidNavigationKind =
  | "trusted-coordinate-route"
  | "google-place-route"
  | "google-search-confirm";

export type NavigationTrustLevel = "direct-verified" | "google-place" | "confirm-first";

export type MasjidNavigationAction = {
  kind: MasjidNavigationKind;
  trustLevel: NavigationTrustLevel;
  label: string;
  href: string;
  trustedForDirectRoute: boolean;
  helperText: string;
  badgeLabel: string;
  badgeTone: "success" | "info" | "warning";
};

function finiteCoordinate(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coordinatesParam(coordinates: Coordinates): string {
  const lat = finiteCoordinate(coordinates.lat);
  const lng = finiteCoordinate(coordinates.lng);
  if (lat === undefined || lng === undefined) {
    throw new Error("Cannot build Maps URL without valid coordinates.");
  }
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function maybeCoordinatesParam(coordinates?: Coordinates): string | undefined {
  if (!coordinates) return undefined;
  try {
    return coordinatesParam(coordinates);
  } catch {
    return undefined;
  }
}

function shouldIncludeFixedOrigin(): boolean {
  if (typeof navigator === "undefined") return true;
  // On phones, omitting origin lets Google Maps use the live GPS location and
  // continue normal turn-by-turn tracking after the Maps app opens.
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function withOrigin(params: URLSearchParams, origin?: Coordinates): void {
  if (!shouldIncludeFixedOrigin()) return;
  const originParam = maybeCoordinatesParam(origin);
  if (originParam) params.set("origin", originParam);
}

function cleanPart(value?: string): string {
  return (value ?? "")
    .replace(/\b(IN|India|N\/A|undefined|null)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const part of parts.map(cleanPart).filter(Boolean)) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(part);
  }
  return output;
}

function externalSearchQuery(masjid: Masjid): string {
  // Important: for unverified external results, do not route to raw provider
  // coordinates. Search Google Maps by the human-readable mosque identity first.
  // This lets Maps resolve its own real listing and prevents shifted provider pins
  // from sending users to houses/shops.
  const parts = dedupeParts([
    masjid.name,
    masjid.locality,
    masjid.address,
    "mosque",
    "masjid"
  ]);
  const query = parts.join(" ").replace(/\s+/g, " ").trim();
  if (query.length >= 8) return query;
  return `mosque masjid near ${coordinatesParam(masjid.coordinates)}`;
}

function directCoordinateRouteUrl(destination: Coordinates, origin?: Coordinates): string {
  const params = new URLSearchParams({
    api: "1",
    destination: coordinatesParam(destination),
    travelmode: "walking",
    dir_action: "navigate"
  });
  withOrigin(params, origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function googlePlaceRouteUrl(masjid: Masjid, origin?: Coordinates): string {
  const params = new URLSearchParams({
    api: "1",
    destination: externalSearchQuery(masjid),
    destination_place_id: masjid.googlePlaceId ?? "",
    travelmode: "walking",
    dir_action: "navigate"
  });
  withOrigin(params, origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function searchFirstUrl(masjid: Masjid): string {
  const params = new URLSearchParams({
    api: "1",
    query: externalSearchQuery(masjid)
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function isTrustedForDirectNavigation(masjid: Masjid): boolean {
  // Direct turn-by-turn routing is unlocked only after verification AND a route
  // test. This is the strongest practical protection against provider pins that
  // have the right name but a shifted coordinate.
  return (
    (masjid.verificationStatus === "admin_verified" || masjid.verificationStatus === "community_checked") &&
    masjid.navigationVerified === true
  );
}

export function isGooglePlaceNavigationReady(masjid: Masjid): boolean {
  // A Google Place ID route lets Google Maps resolve the actual listing. It is
  // safer than raw Foursquare/OSM/Mappls coordinates, although jamaat timings may
  // still be unverified.
  return Boolean(masjid.googlePlaceId);
}

export function isDirectNavigationReady(masjid: Masjid): boolean {
  return isTrustedForDirectNavigation(masjid) || isGooglePlaceNavigationReady(masjid);
}

export function getNavigationTrustText(masjid: Masjid): string {
  if (isTrustedForDirectNavigation(masjid)) return "Route-tested verified pin";
  if (isGooglePlaceNavigationReady(masjid)) return "Google listing route";
  return "Confirm in Google Maps first";
}

export function getMasjidNavigationAction(masjid: Masjid, origin?: Coordinates): MasjidNavigationAction {
  if (isTrustedForDirectNavigation(masjid)) {
    return {
      kind: "trusted-coordinate-route",
      trustLevel: "direct-verified",
      label: "Start nav",
      href: directCoordinateRouteUrl(masjid.coordinates, origin),
      trustedForDirectRoute: true,
      helperText: "Route-tested verified pin: direct navigation uses the verified coordinates.",
      badgeLabel: "Direct route verified",
      badgeTone: "success"
    };
  }

  if (isGooglePlaceNavigationReady(masjid)) {
    return {
      kind: "google-place-route",
      trustLevel: "google-place",
      label: "Start nav",
      href: googlePlaceRouteUrl(masjid, origin),
      trustedForDirectRoute: true,
      helperText: "Google Place ID route: Google Maps resolves the actual place listing.",
      badgeLabel: "Google listing route",
      badgeTone: "info"
    };
  }

  return {
    kind: "google-search-confirm",
    trustLevel: "confirm-first",
    label: "Confirm in Maps",
    href: searchFirstUrl(masjid),
    trustedForDirectRoute: false,
    helperText: "Unverified external result: open Google Maps search, choose the real mosque listing, then tap Directions inside Google Maps.",
    badgeLabel: "Confirm before route",
    badgeTone: "warning"
  };
}

export function navigationAuditReason(masjid: Masjid): string {
  if (isTrustedForDirectNavigation(masjid)) {
    return "This masjid has been verified and route-tested by admin/community workflow.";
  }
  if (isGooglePlaceNavigationReady(masjid)) {
    return "This result has a Google Place ID, so Google Maps can resolve the destination by listing rather than raw coordinates.";
  }
  return "This result came from an external discovery provider. The app blocks raw one-tap coordinate navigation and opens Google Maps confirmation first.";
}
