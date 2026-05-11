import type { Masjid, VerificationStatus } from "@/types";
import { isDirectNavigationReady, isTrustedForDirectNavigation } from "@/lib/navigationTrust";

export type CityCoverageSnapshot = {
  city: string;
  found: number;
  verified: number;
  jumuahTimings: number;
  source: string;
  updatedAt?: string;
};

export type CoverageStats = {
  total: number;
  verified: number;
  communityChecked: number;
  navigationReady: number;
  withJumuah: number;
  withPhone: number;
  withFacilities: number;
  externalDiscovered: number;
  needsVerification: number;
  directRouteReady: number;
  byStatus: Record<VerificationStatus, number>;
  byCity: Array<{
    city: string;
    total: number;
    verified: number;
    navigationReady: number;
    withJumuah: number;
  }>;
  launchWarnings: string[];
};

const emptyStatus: Record<VerificationStatus, number> = {
  admin_verified: 0,
  community_checked: 0,
  demo_unverified: 0,
  osm_discovered: 0,
  google_discovered: 0,
  mappls_discovered: 0,
  foursquare_discovered: 0
};

function cityKey(masjid: Masjid): string {
  const text = `${masjid.locality || ""} ${masjid.address || ""}`.toLowerCase();
  if (text.includes("chennai")) return "Chennai";
  if (text.includes("mumbai")) return "Mumbai";
  if (text.includes("hyderabad")) return "Hyderabad";
  if (text.includes("delhi")) return "Delhi";
  if (text.includes("kochi") || text.includes("kerala")) return "Kerala";
  return masjid.locality?.trim() || "Unknown";
}

export function computeCoverageStats(masjids: Masjid[]): CoverageStats {
  const byStatus = { ...emptyStatus };
  const cityMap = new Map<string, { city: string; total: number; verified: number; navigationReady: number; withJumuah: number }>();

  for (const masjid of masjids) {
    byStatus[masjid.verificationStatus] = (byStatus[masjid.verificationStatus] ?? 0) + 1;
    const city = cityKey(masjid);
    const row = cityMap.get(city) ?? { city, total: 0, verified: 0, navigationReady: 0, withJumuah: 0 };
    row.total += 1;
    if (isTrustedForDirectNavigation(masjid)) row.verified += 1;
    if (masjid.navigationVerified || isDirectNavigationReady(masjid)) row.navigationReady += 1;
    if (masjid.jumuah?.length) row.withJumuah += 1;
    cityMap.set(city, row);
  }

  const total = masjids.length;
  const verified = masjids.filter((item) => item.verificationStatus === "admin_verified").length;
  const communityChecked = masjids.filter((item) => item.verificationStatus === "community_checked").length;
  const navigationReady = masjids.filter((item) => item.navigationVerified === true).length;
  const withJumuah = masjids.filter((item) => item.jumuah?.length).length;
  const directRouteReady = masjids.filter(isDirectNavigationReady).length;
  const externalDiscovered = masjids.filter((item) => item.source && item.source !== "firestore" && item.source !== "demo").length;
  const needsVerification = masjids.filter((item) => !isDirectNavigationReady(item)).length;

  const launchWarnings: string[] = [];
  if (total === 0) launchWarnings.push("No masjid records exist yet.");
  if (verified < 10) launchWarnings.push("Add/verify at least 10 local masjids before public beta.");
  if (navigationReady < verified) launchWarnings.push("Some verified masjids still need route testing before direct navigation.");
  if (withJumuah < Math.min(verified, 5)) launchWarnings.push("Jumu’ah timings are still thin. Add them for local verified masjids.");

  return {
    total,
    verified,
    communityChecked,
    navigationReady,
    withJumuah,
    withPhone: masjids.filter((item) => Boolean(item.phone)).length,
    withFacilities: masjids.filter((item) => item.facilities?.length).length,
    externalDiscovered,
    needsVerification,
    directRouteReady,
    byStatus,
    byCity: Array.from(cityMap.values()).sort((a, b) => b.total - a.total),
    launchWarnings
  };
}

export const chennaiPipelineSnapshot: CityCoverageSnapshot = {
  city: "Chennai",
  found: 812,
  verified: 203,
  jumuahTimings: 97,
  source: "Pipeline snapshot / target dataset",
  updatedAt: "2026-05-11"
};
