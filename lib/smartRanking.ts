import type { Masjid } from "@/types";
import { bikeMinutes, walkingMinutes } from "@/lib/geo";
import { getNextJamaat } from "@/lib/jamaat";
import { calculateTrustScore } from "@/lib/trustScore";
import { hasVerifiedTimings, listingQualityPenalty } from "@/lib/verification";

export type ReachMode = "walk" | "bike_auto" | "too_late" | "unknown";

export type JamaatReachDecision = {
  mode: ReachMode;
  headline: string;
  detail: string;
  priority: number;
  minutesUntil?: number;
  walkMinutes?: number;
  bikeMinutes?: number;
  bufferMinutes?: number;
};

export type SmartRankedMasjid = {
  masjid: Masjid;
  distance: number;
  rankScore: number;
  reach: JamaatReachDecision;
};

export function evaluateJamaatReach(masjid: Masjid, distanceKm?: number, now = new Date()): JamaatReachDecision {
  if (!hasVerifiedTimings(masjid)) {
    return {
      mode: "unknown",
      headline: "Timing unknown",
      detail: "Location discovered. Submit timings to unlock reach-before-jamaat guidance.",
      priority: 0
    };
  }

  if (distanceKm === undefined || !Number.isFinite(distanceKm)) {
    return {
      mode: "unknown",
      headline: "Use location",
      detail: "Use your location to know whether you can reach before jamaat.",
      priority: 8
    };
  }

  const next = getNextJamaat(masjid, now);
  const walk = walkingMinutes(distanceKm) ?? 999;
  const bike = bikeMinutes(distanceKm) ?? 999;
  const walkBuffer = next.minutesUntil - walk;
  const bikeBuffer = next.minutesUntil - bike;

  if (walkBuffer >= 0) {
    const tight = walkBuffer <= 3;
    return {
      mode: "walk",
      headline: tight ? "Walk now" : "Reach by walking",
      detail: `${next.displayName} starts in ${next.minutesUntil} min. Walk time ${walk} min${tight ? " — tight" : ` · ${walkBuffer} min buffer`}.`,
      priority: tight ? 95 : 100,
      minutesUntil: next.minutesUntil,
      walkMinutes: walk,
      bikeMinutes: bike,
      bufferMinutes: walkBuffer
    };
  }

  if (bikeBuffer >= 0) {
    const tight = bikeBuffer <= 3;
    return {
      mode: "bike_auto",
      headline: tight ? "Auto/bike now" : "Reach by bike/auto",
      detail: `${next.displayName} starts in ${next.minutesUntil} min. Walk may be late; bike/auto estimate ${bike} min${tight ? " — tight" : ` · ${bikeBuffer} min buffer`}.`,
      priority: tight ? 78 : 86,
      minutesUntil: next.minutesUntil,
      walkMinutes: walk,
      bikeMinutes: bike,
      bufferMinutes: bikeBuffer
    };
  }

  return {
    mode: "too_late",
    headline: `Likely late for ${next.displayName}`,
    detail: `${next.displayName} starts in ${next.minutesUntil} min, but walking is about ${walk} min. Check another masjid or the next salah.`,
    priority: 28,
    minutesUntil: next.minutesUntil,
    walkMinutes: walk,
    bikeMinutes: bike,
    bufferMinutes: Math.max(walkBuffer, bikeBuffer)
  };
}

export function smartRankScore(masjid: Masjid, distanceKm: number, now = new Date()): number {
  const trust = calculateTrustScore(masjid).score;
  const reach = evaluateJamaatReach(masjid, distanceKm, now);
  const distanceScore = Math.max(0, 120 - distanceKm * 16);
  const qualityPenalty = listingQualityPenalty(masjid) * 10;
  const verifiedTimingBonus = hasVerifiedTimings(masjid) ? 35 : 0;

  return Math.round(distanceScore + trust * 0.8 + reach.priority + verifiedTimingBonus - qualityPenalty);
}

export function rankMasjidsForJamaat(items: Array<{ masjid: Masjid; distance: number }>, now = new Date()): SmartRankedMasjid[] {
  return items
    .map(({ masjid, distance }) => ({
      masjid,
      distance,
      reach: evaluateJamaatReach(masjid, distance, now),
      rankScore: smartRankScore(masjid, distance, now)
    }))
    .sort((a, b) => {
      const scoreDelta = b.rankScore - a.rankScore;
      if (Math.abs(scoreDelta) > 8) return scoreDelta;
      const distanceDelta = a.distance - b.distance;
      if (Math.abs(distanceDelta) > 0.035) return distanceDelta;
      return listingQualityPenalty(a.masjid) - listingQualityPenalty(b.masjid);
    });
}

export function nearestRank(items: Array<{ masjid: Masjid; distance: number }>): Array<{ masjid: Masjid; distance: number; reach: JamaatReachDecision; rankScore: number }> {
  return items
    .map(({ masjid, distance }) => ({ masjid, distance, reach: evaluateJamaatReach(masjid, distance), rankScore: smartRankScore(masjid, distance) }))
    .sort((a, b) => {
      const distanceDelta = a.distance - b.distance;
      if (Math.abs(distanceDelta) > 0.035) return distanceDelta;
      return listingQualityPenalty(a.masjid) - listingQualityPenalty(b.masjid);
    });
}
