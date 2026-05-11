"use client";

import type { Masjid } from "@/types";

export type ParsedOsmUrl = {
  type: "node" | "way" | "relation";
  id: number;
};

export function parseOpenStreetMapObjectUrl(value: string): ParsedOsmUrl | undefined {
  const trimmed = value.trim();
  const match = trimmed.match(/openstreetmap\.org\/(node|way|relation)\/(\d+)/i) || trimmed.match(/^(node|way|relation)\s*[:/#-]?\s*(\d+)$/i);
  if (!match) return undefined;
  const type = match[1].toLowerCase() as ParsedOsmUrl["type"];
  const id = Number(match[2]);
  if (!Number.isFinite(id) || id <= 0) return undefined;
  return { type, id };
}

export async function importOpenStreetMapObject(value: string): Promise<Masjid> {
  const parsed = parseOpenStreetMapObjectUrl(value);
  if (!parsed) throw new Error("Paste an OpenStreetMap link like https://www.openstreetmap.org/way/12345 or node 12345.");

  const params = new URLSearchParams({ type: parsed.type, id: String(parsed.id) });
  const response = await fetch(`/api/osm-object?${params.toString()}`);
  const data = (await response.json()) as { masjid?: Masjid; message?: string };
  if (!response.ok || !data.masjid) {
    throw new Error(data.message || "Could not import that OpenStreetMap object.");
  }
  return data.masjid;
}
