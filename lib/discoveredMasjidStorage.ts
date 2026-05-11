"use client";

import type { Masjid } from "@/types";
import { isLikelyStreetOnlyFalsePositive } from "@/lib/masjidDisplay";

const STORAGE_KEY = "wmm_discovered_masjids_v1";
const MAX_STORED = 400;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readDiscoveredMasjids(): Masjid[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Masjid => Boolean(item && typeof item === "object" && "id" in item))
      .filter((masjid) => !isLikelyStreetOnlyFalsePositive(masjid));
  } catch {
    return [];
  }
}

export function saveDiscoveredMasjids(masjids: Masjid[]): void {
  if (!canUseStorage() || !masjids.length) return;

  const existing = readDiscoveredMasjids();
  const merged = new Map<string, Masjid>();

  [...masjids, ...existing].forEach((masjid) => {
    if (masjid.id && !isLikelyStreetOnlyFalsePositive(masjid)) merged.set(masjid.id, masjid);
  });

  const nextValue = Array.from(merged.values()).slice(0, MAX_STORED);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
}

export function getStoredDiscoveredMasjid(id: string): Masjid | undefined {
  return readDiscoveredMasjids().find((masjid) => masjid.id === id);
}
