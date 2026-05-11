"use client";

import type { Masjid } from "@/types";

const SNAPSHOT_KEY = "wmm.savedMasjidSnapshots.v1";
const ID_KEY = "wmm.savedMasjidIds";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("wmm:saved-masjids-changed"));
}

function readIdsOnly(): string[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ID_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeIdsOnly(ids: string[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ID_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function readSavedMasjids(): Masjid[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Masjid => Boolean(item && typeof item === "object" && "id" in item))
      : [];
  } catch {
    return [];
  }
}

function writeSavedMasjids(masjids: Masjid[]): void {
  if (!canUseStorage()) return;
  const unique = new Map<string, Masjid>();
  masjids.forEach((masjid) => unique.set(masjid.id, masjid));
  const snapshots = Array.from(unique.values()).slice(0, 150);
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  writeIdsOnly(snapshots.map((masjid) => masjid.id));
  emitChange();
}

export function getSavedMasjidIds(): string[] {
  const snapshotIds = readSavedMasjids().map((masjid) => masjid.id);
  return Array.from(new Set([...snapshotIds, ...readIdsOnly()]));
}

export function isMasjidSaved(id: string): boolean {
  return getSavedMasjidIds().includes(id);
}

export const isSavedMasjid = isMasjidSaved;


export function saveMasjidSnapshot(masjid: Masjid): string[] {
  const existing = readSavedMasjids().filter((item) => item.id !== masjid.id);
  writeSavedMasjids([masjid, ...existing]);
  return getSavedMasjidIds();
}

export function removeSavedMasjidId(id: string): string[] {
  writeSavedMasjids(readSavedMasjids().filter((item) => item.id !== id));
  const ids = readIdsOnly().filter((item) => item !== id);
  writeIdsOnly(ids);
  emitChange();
  return getSavedMasjidIds();
}

export function toggleSavedMasjid(masjid: Masjid): { saved: boolean; ids: string[] } {
  if (isMasjidSaved(masjid.id)) return { saved: false, ids: removeSavedMasjidId(masjid.id) };
  return { saved: true, ids: saveMasjidSnapshot(masjid) };
}

export function toggleSavedMasjidId(id: string): { saved: boolean; ids: string[] } {
  if (isMasjidSaved(id)) return { saved: false, ids: removeSavedMasjidId(id) };
  const ids = Array.from(new Set([...readIdsOnly(), id]));
  writeIdsOnly(ids);
  emitChange();
  return { saved: true, ids };
}
