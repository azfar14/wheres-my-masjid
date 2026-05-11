import type { Masjid, SalahKey } from "@/types";

const salahKeys: SalahKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export type PipelineValidationIssue = {
  index: number;
  id?: string;
  severity: "error" | "warning";
  message: string;
};

export type PipelinePreview = {
  valid: Masjid[];
  issues: PipelineValidationIssue[];
  stats: {
    totalInput: number;
    valid: number;
    errors: number;
    warnings: number;
    verified: number;
    withJumuah: number;
    navigationReady: number;
  };
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function timeOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeRecord(input: any, index: number): { masjid?: Masjid; issues: PipelineValidationIssue[] } {
  const issues: PipelineValidationIssue[] = [];
  const name = String(input.name ?? input.placeName ?? input.masjidName ?? "").trim();
  const address = String(input.address ?? input.placeAddress ?? "").trim();
  const locality = String(input.locality ?? input.area ?? input.city ?? "").trim() || "Locality not added";
  const rawLat = input.lat ?? input.latitude ?? input.coordinates?.lat;
  const rawLng = input.lng ?? input.longitude ?? input.coordinates?.lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const id = String(input.id ?? slugify(`${name}-${locality}-${index + 1}`)).toLowerCase();

  if (!name) issues.push({ index, id, severity: "error", message: "Missing masjid name." });
  if (!address) issues.push({ index, id, severity: "warning", message: "Address is missing; verification team should fill it before route unlock." });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) issues.push({ index, id, severity: "error", message: "Missing numeric lat/lng. Cannot import without a coordinate." });
  if (Number.isFinite(lat) && (lat < -90 || lat > 90)) issues.push({ index, id, severity: "error", message: "Latitude is outside valid range." });
  if (Number.isFinite(lng) && (lng < -180 || lng > 180)) issues.push({ index, id, severity: "error", message: "Longitude is outside valid range." });

  const jamaat = input.jamaat ?? {};
  const normalizedJamaat = {
    fajr: timeOrDefault(jamaat.fajr ?? input.fajr, "05:10"),
    dhuhr: timeOrDefault(jamaat.dhuhr ?? input.dhuhr, "13:30"),
    asr: timeOrDefault(jamaat.asr ?? input.asr, "17:15"),
    maghrib: timeOrDefault(jamaat.maghrib ?? input.maghrib, "18:45"),
    isha: timeOrDefault(jamaat.isha ?? input.isha, "20:15")
  } satisfies Record<SalahKey, string>;

  for (const key of salahKeys) {
    const raw = jamaat[key] ?? input[key];
    if (raw && normalizedJamaat[key] !== raw) {
      issues.push({ index, id, severity: "warning", message: `${key} timing was not HH:MM; default kept until verification.` });
    }
  }

  const hasErrors = issues.some((issue) => issue.severity === "error");
  if (hasErrors) return { issues };

  const masjid: Masjid = {
    id: id || `masjid-${index + 1}`,
    name,
    locality,
    address: address || locality,
    coordinates: { lat, lng },
    phone: typeof input.phone === "string" ? input.phone : undefined,
    facilities: arrayOfStrings(input.facilities),
    khutbahLanguages: arrayOfStrings(input.khutbahLanguages),
    verificationStatus: input.verificationStatus === "admin_verified" ? "admin_verified" : input.verificationStatus === "community_checked" ? "community_checked" : "community_checked",
    navigationVerified: input.navigationVerified === true,
    lastVerifiedAt: typeof input.lastVerifiedAt === "string" ? input.lastVerifiedAt : new Date().toISOString().slice(0, 10),
    jamaat: normalizedJamaat,
    jumuah: arrayOfStrings(input.jumuah ?? input.jummah ?? input.jumuahTimings),
    notes: typeof input.notes === "string" ? input.notes : "Imported through admin data pipeline. Verify pin before unlocking direct navigation.",
    source: input.source === "community_report" ? "community_report" : "firestore",
    verificationChecklist: input.verificationChecklist,
    assignedAdminIds: arrayOfStrings(input.assignedAdminIds)
  };

  return { masjid, issues };
}

export function previewMasjidImport(jsonText: string): PipelinePreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      valid: [],
      issues: [{ index: 0, severity: "error", message: "Invalid JSON. Paste an array of masjid objects." }],
      stats: { totalInput: 0, valid: 0, errors: 1, warnings: 0, verified: 0, withJumuah: 0, navigationReady: 0 }
    };
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const valid: Masjid[] = [];
  const issues: PipelineValidationIssue[] = [];
  rows.forEach((row, index) => {
    const result = normalizeRecord(row, index);
    issues.push(...result.issues);
    if (result.masjid) valid.push(result.masjid);
  });

  return {
    valid,
    issues,
    stats: {
      totalInput: rows.length,
      valid: valid.length,
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      verified: valid.filter((item) => item.verificationStatus === "admin_verified").length,
      withJumuah: valid.filter((item) => item.jumuah.length).length,
      navigationReady: valid.filter((item) => item.navigationVerified).length
    }
  };
}
