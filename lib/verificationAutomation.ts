import type { Masjid } from "@/types";

export type VerificationPriority = {
  priority: "urgent" | "high" | "normal" | "low";
  score: number;
  reasons: string[];
  recommendedAction: string;
};

function hasWeakName(masjid: Masjid): boolean {
  const name = masjid.name.toLowerCase();
  return name === "masjid" || name === "mosque" || name.includes("possible") || name.includes("unnamed") || name.includes("street");
}

export function verificationPriority(masjid: Masjid): VerificationPriority {
  let score = 0;
  const reasons: string[] = [];

  if (!masjid.navigationVerified) {
    score += 35;
    reasons.push("navigation pin is not route-tested");
  }
  if (masjid.verificationStatus !== "admin_verified" && masjid.verificationStatus !== "community_checked") {
    score += 25;
    reasons.push("listing is not verified");
  }
  if (hasWeakName(masjid)) {
    score += 15;
    reasons.push("name needs human confirmation");
  }
  if (masjid.coordinatesApproximate) {
    score += 20;
    reasons.push("provider returned approximate / eLoc-only coordinates");
  }
  if (!masjid.jumuah.length) {
    score += 8;
    reasons.push("Jumu’ah timings missing");
  }
  if (!masjid.facilities.length) {
    score += 5;
    reasons.push("facilities missing");
  }
  if ((masjid.providerSources ?? []).length >= 2) {
    score -= 8;
    reasons.push("multiple providers agree on this listing");
  }

  const priority = score >= 55 ? "urgent" : score >= 35 ? "high" : score >= 15 ? "normal" : "low";
  const recommendedAction = priority === "urgent"
    ? "Verify exact Google route before allowing direct navigation."
    : priority === "high"
      ? "Confirm name, address, and pin from Google Maps or local proof."
      : priority === "normal"
        ? "Add timings/facilities when available."
        : "Keep monitored; no immediate blocker.";

  return { priority, score: Math.max(0, score), reasons, recommendedAction };
}

export function nextVerificationBatch(masjids: Masjid[], limit = 20): Array<{ masjid: Masjid; priority: VerificationPriority }> {
  return masjids
    .map((masjid) => ({ masjid, priority: verificationPriority(masjid) }))
    .sort((a, b) => b.priority.score - a.priority.score || a.masjid.name.localeCompare(b.masjid.name))
    .slice(0, limit);
}
