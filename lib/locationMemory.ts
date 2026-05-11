"use client";

import type { Coordinates } from "@/types";

const KEY = "wmm:last-location";

type StoredLocation = { coordinates: Coordinates; label?: string; savedAt: string };

export function rememberLocation(coordinates: Coordinates, label?: string): void {
  if (typeof window === "undefined") return;
  try {
    const value: StoredLocation = { coordinates, label, savedAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // localStorage can be blocked; ignore.
  }
}

export function readRememberedLocation(): StoredLocation | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (!parsed?.coordinates) return undefined;
    const { lat, lng } = parsed.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
