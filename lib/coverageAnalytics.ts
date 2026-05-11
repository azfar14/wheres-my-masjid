import type { ListingSource, Masjid, SalahKey } from "@/types";

export type CoverageMetrics = {
  total: number;
  adminVerified: number;
  communityChecked: number;
  navigationReady: number;
  withJumuah: number;
  withAllDailyJamaat: number;
  withPhone: number;
  withFacilities: number;
  externalDiscovery: number;
  sourceBreakdown: Record<string, number>;
  verificationRate: number;
  jumuahRate: number;
  navigationReadyRate: number;
  timingCoverageRate: number;
};

export type CityCoverageTarget = {
  city: string;
  discovered: number;
  verified: number;
  withJumuah: number;
  notes?: string;
};

const salahKeys: SalahKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function hasAllDailyJamaat(masjid: Masjid): boolean {
  return salahKeys.every((key) => /^\d{2}:\d{2}$/.test(masjid.jamaat?.[key] ?? ""));
}

export function isVerifiedMasjid(masjid: Masjid): boolean {
  return masjid.verificationStatus === "admin_verified" || masjid.verificationStatus === "community_checked";
}

export function isExternalDiscovery(masjid: Masjid): boolean {
  return Boolean(masjid.source && ["foursquare", "mappls", "openstreetmap", "google_places"].includes(masjid.source));
}

export function calculateCoverageMetrics(masjids: Masjid[]): CoverageMetrics {
  const sourceBreakdown: Record<string, number> = {};
  for (const masjid of masjids) {
    const source = masjid.source ?? "firestore";
    sourceBreakdown[source] = (sourceBreakdown[source] ?? 0) + 1;
    for (const provider of masjid.providerSources ?? []) {
      sourceBreakdown[`matched:${provider}`] = (sourceBreakdown[`matched:${provider}`] ?? 0) + 1;
    }
  }

  const total = masjids.length;
  const adminVerified = masjids.filter((masjid) => masjid.verificationStatus === "admin_verified").length;
  const communityChecked = masjids.filter((masjid) => masjid.verificationStatus === "community_checked").length;
  const navigationReady = masjids.filter((masjid) => masjid.navigationVerified === true).length;
  const withJumuah = masjids.filter((masjid) => masjid.jumuah.length > 0).length;
  const withAllDailyJamaat = masjids.filter(hasAllDailyJamaat).length;
  const withPhone = masjids.filter((masjid) => Boolean(masjid.phone)).length;
  const withFacilities = masjids.filter((masjid) => masjid.facilities.length > 0).length;
  const externalDiscovery = masjids.filter(isExternalDiscovery).length;

  return {
    total,
    adminVerified,
    communityChecked,
    navigationReady,
    withJumuah,
    withAllDailyJamaat,
    withPhone,
    withFacilities,
    externalDiscovery,
    sourceBreakdown,
    verificationRate: pct(adminVerified + communityChecked, total),
    jumuahRate: pct(withJumuah, total),
    navigationReadyRate: pct(navigationReady, total),
    timingCoverageRate: pct(withAllDailyJamaat, total)
  };
}

export function cityTargetProgress(metrics: CoverageMetrics, target: CityCoverageTarget) {
  return {
    discovered: pct(metrics.total, target.discovered),
    verified: pct(metrics.adminVerified + metrics.communityChecked, target.verified),
    jumuah: pct(metrics.withJumuah, target.withJumuah)
  };
}

export function sourceLabel(source: ListingSource | string | undefined): string {
  if (!source) return "Firestore/manual";
  return source
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
