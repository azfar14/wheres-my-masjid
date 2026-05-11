import type { Masjid } from "@/types";
import { bikeMinutes, walkingMinutes } from "@/lib/geo";
import { getNextJamaat } from "@/lib/jamaat";
import { hasVerifiedTimings } from "@/lib/verification";

export function reachabilityAdvice(masjid: Masjid, distanceKm?: number): string {
  if (!hasVerifiedTimings(masjid)) return "Timing unknown — verify locally.";
  if (distanceKm === undefined) return "Use location to check reachability.";

  const next = getNextJamaat(masjid);
  const walk = walkingMinutes(distanceKm);
  const bike = bikeMinutes(distanceKm);

  if (walk !== undefined && walk <= next.minutesUntil) {
    const buffer = next.minutesUntil - walk;
    return buffer <= 2 ? "Leave now — reachable by walking." : `Walkable · ${buffer} min buffer.`;
  }

  if (bike !== undefined && bike <= next.minutesUntil) {
    const buffer = next.minutesUntil - bike;
    return buffer <= 2 ? "Bike/auto now — tight timing." : `Bike/auto works · ${buffer} min buffer.`;
  }

  return `Likely late for ${next.displayName}; check next nearby jamaat.`;
}
