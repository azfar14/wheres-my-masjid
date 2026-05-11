import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { masjids as demoMasjids, getMasjidById as getDemoMasjidById } from "@/lib/masjids";
import { chennaiStarterMasjids } from "@/lib/chennaiMasjids";
import type {
  Masjid,
  MasjidListResult,
  SalahKey,
  Suggestion,
  SuggestionInput,
  SuggestionStatus,
  TimingUpdate,
  ClaimRequest,
  ClaimRequestInput,
  ClaimStatus,
  AuditAction,
  AdminProfile,
  AdminRole,
  MasjidVerificationChecklist,
  VerificationStatus
} from "@/types";

const salahKeys: SalahKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const defaultJamaat: Record<SalahKey, string> = {
  fajr: "05:10",
  dhuhr: "13:30",
  asr: "17:15",
  maghrib: "18:45",
  isha: "20:15"
};

const salahAliases: Record<SalahKey, string[]> = {
  fajr: ["fajr", "fajar", "subh", "subuh"],
  dhuhr: ["dhuhr", "zuhr", "zuhur", "duhr", "dhur", "zohr"],
  asr: ["asr", "asar"],
  maghrib: ["maghrib", "magrib", "magreb", "magrib"],
  isha: ["isha", "esha", "ishaa"]
};

function todayDateId(): string {
  return new Date().toISOString().slice(0, 10);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function asTime(value: unknown, fallback: string): string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function dateLikeToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      try {
        return maybeTimestamp.toDate().toISOString().slice(0, 10);
      } catch {
        return todayDateId();
      }
    }
  }
  return todayDateId();
}

function normalizeChecklist(value: unknown): MasjidVerificationChecklist | undefined {
  if (!value || typeof value !== "object") return undefined;
  const checklist = value as Partial<Record<keyof MasjidVerificationChecklist, unknown>>;
  return {
    nameChecked: checklist.nameChecked === true,
    addressChecked: checklist.addressChecked === true,
    pinChecked: checklist.pinChecked === true,
    routeTested: checklist.routeTested === true,
    timingsChecked: checklist.timingsChecked === true,
    contactChecked: checklist.contactChecked === true
  };
}

function checklistComplete(checklist: MasjidVerificationChecklist): boolean {
  return checklist.nameChecked && checklist.addressChecked && checklist.pinChecked && checklist.routeTested && checklist.timingsChecked;
}

export function parseJumuahTimes(value: string): string[] {
  return value
    .split(/[\n,/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parseLooseTime(item) ?? item);
}

function parseLooseTime(value: string): string | undefined {
  const match = value.toLowerCase().match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3]?.toLowerCase();

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return undefined;

  if (suffix === "am") {
    if (hour === 12) hour = 0;
  } else if (suffix === "pm") {
    if (hour !== 12) hour += 12;
  }

  if (hour < 0 || hour > 23) return undefined;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function detectSalah(value: string): SalahKey | undefined {
  const normalized = value.toLowerCase();
  for (const salah of salahKeys) {
    if (salahAliases[salah].some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(normalized))) {
      return salah;
    }
  }
  return undefined;
}

function normalizeMasjid(id: string, data: Record<string, unknown>): Masjid {
  const fallback = getDemoMasjidById(id) ?? {
    id,
    name: "Unnamed masjid",
    locality: "Locality not added",
    address: "Address not added",
    coordinates: { lat: 13.0827, lng: 80.2707 },
    phone: undefined,
    facilities: [],
    khutbahLanguages: [],
    verificationStatus: "demo_unverified" as const,
    lastVerifiedAt: todayDateId(),
    jamaat: defaultJamaat,
    jumuah: [],
    notes: undefined
  };
  const coordinates = data.coordinates as Partial<Masjid["coordinates"]> | undefined;
  const jamaat = data.jamaat as Partial<Record<SalahKey, unknown>> | undefined;

  return {
    id,
    name: typeof data.name === "string" ? data.name : fallback.name,
    locality: typeof data.locality === "string" ? data.locality : fallback.locality,
    address: typeof data.address === "string" ? data.address : fallback.address,
    coordinates: {
      lat: typeof coordinates?.lat === "number" ? coordinates.lat : fallback.coordinates.lat,
      lng: typeof coordinates?.lng === "number" ? coordinates.lng : fallback.coordinates.lng
    },
    phone: typeof data.phone === "string" ? data.phone : fallback.phone,
    facilities: asStringArray(data.facilities).length ? asStringArray(data.facilities) : fallback.facilities,
    khutbahLanguages: asStringArray(data.khutbahLanguages).length
      ? asStringArray(data.khutbahLanguages)
      : fallback.khutbahLanguages,
    verificationStatus:
      data.verificationStatus === "admin_verified" ||
      data.verificationStatus === "community_checked" ||
      data.verificationStatus === "osm_discovered" ||
      data.verificationStatus === "google_discovered" ||
      data.verificationStatus === "mappls_discovered" ||
      data.verificationStatus === "foursquare_discovered"
        ? data.verificationStatus
        : "demo_unverified",
    lastVerifiedAt: dateLikeToString(data.lastVerifiedAt),
    jamaat: {
      fajr: asTime(jamaat?.fajr, fallback.jamaat.fajr),
      dhuhr: asTime(jamaat?.dhuhr, fallback.jamaat.dhuhr),
      asr: asTime(jamaat?.asr, fallback.jamaat.asr),
      maghrib: asTime(jamaat?.maghrib, fallback.jamaat.maghrib),
      isha: asTime(jamaat?.isha, fallback.jamaat.isha)
    },
    jumuah: asStringArray(data.jumuah),
    notes: typeof data.notes === "string" ? data.notes : fallback.notes,
    source:
      data.source === "openstreetmap" || data.source === "google_places" || data.source === "mappls" || data.source === "foursquare" || data.source === "demo" || data.source === "firestore" || data.source === "community_report"
        ? data.source
        : "firestore",
    osm: data.osm && typeof data.osm === "object"
      ? (data.osm as Masjid["osm"])
      : undefined,
    osmConfidence: data.osmConfidence === "named" || data.osmConfidence === "unnamed" || data.osmConfidence === "possible"
      ? data.osmConfidence
      : undefined,
    googlePlaceId: typeof data.googlePlaceId === "string" ? data.googlePlaceId : undefined,
    googleMapsUri: typeof data.googleMapsUri === "string" ? data.googleMapsUri : undefined,
    mapplsELoc: typeof data.mapplsELoc === "string" ? data.mapplsELoc : undefined,
    foursquareId: typeof data.foursquareId === "string" ? data.foursquareId : undefined,
    providerUrl: typeof data.providerUrl === "string" ? data.providerUrl : undefined,
    providerConfidence: typeof data.providerConfidence === "number" ? data.providerConfidence : undefined,
    discoveryQuality:
      data.discoveryQuality === "high" || data.discoveryQuality === "medium" || data.discoveryQuality === "low"
        ? data.discoveryQuality
        : undefined,
    navigationVerified: data.navigationVerified === true,
    verificationChecklist: normalizeChecklist(data.verificationChecklist),
    verificationNotes: typeof data.verificationNotes === "string" ? data.verificationNotes : undefined,
    verifiedBy: typeof data.verifiedBy === "string" ? data.verifiedBy : undefined,
    assignedAdminIds: asStringArray(data.assignedAdminIds),
    lastNavigationTestAt: data.lastNavigationTestAt ? dateLikeToString(data.lastNavigationTestAt) : undefined
  };
}

function masjidToFirestoreData(masjid: Masjid): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: masjid.id,
    name: masjid.name,
    locality: masjid.locality,
    address: masjid.address,
    coordinates: masjid.coordinates,
    facilities: masjid.facilities,
    khutbahLanguages: masjid.khutbahLanguages,
    verificationStatus: masjid.verificationStatus,
    lastVerifiedAt: masjid.lastVerifiedAt,
    jamaat: masjid.jamaat,
    jumuah: masjid.jumuah
  };

  if (masjid.phone) data.phone = masjid.phone;
  if (masjid.notes) data.notes = masjid.notes;
  if (masjid.source) data.source = masjid.source;
  if (masjid.osm) data.osm = masjid.osm;
  if (masjid.osmConfidence) data.osmConfidence = masjid.osmConfidence;
  if (masjid.googlePlaceId) data.googlePlaceId = masjid.googlePlaceId;
  if (masjid.googleMapsUri) data.googleMapsUri = masjid.googleMapsUri;
  if (masjid.mapplsELoc) data.mapplsELoc = masjid.mapplsELoc;
  if (masjid.foursquareId) data.foursquareId = masjid.foursquareId;
  if (masjid.providerUrl) data.providerUrl = masjid.providerUrl;
  if (typeof masjid.providerConfidence === "number") data.providerConfidence = masjid.providerConfidence;
  if (masjid.discoveryQuality) data.discoveryQuality = masjid.discoveryQuality;
  if (typeof masjid.navigationVerified === "boolean") data.navigationVerified = masjid.navigationVerified;
  if (masjid.verificationChecklist) data.verificationChecklist = masjid.verificationChecklist;
  if (masjid.verificationNotes) data.verificationNotes = masjid.verificationNotes;
  if (masjid.verifiedBy) data.verifiedBy = masjid.verifiedBy;
  if (masjid.assignedAdminIds?.length) data.assignedAdminIds = masjid.assignedAdminIds;
  if (masjid.lastNavigationTestAt) data.lastNavigationTestAt = masjid.lastNavigationTestAt;

  return data;
}


async function writeAuditLog(input: {
  action: AuditAction;
  targetCollection: "masjids" | "suggestions" | "claimRequests" | "jamaatTimings" | "admins";
  targetId: string;
  summary: string;
  actorId?: string;
}): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;

  try {
    await addDoc(collection(db, "auditLogs"), {
      ...input,
      actorId: input.actorId ?? null,
      createdAt: serverTimestamp()
    });
  } catch {
    // Audit logging is a production trust feature, but it should never break the
    // main user/admin action during MVP testing. If it fails, the primary write
    // has still succeeded.
  }
}

function normalizeClaimRequest(id: string, data: Record<string, unknown>): ClaimRequest {
  const status = ["pending", "approved", "rejected"].includes(String(data.status))
    ? (data.status as ClaimStatus)
    : "pending";

  return {
    id,
    masjidId: typeof data.masjidId === "string" ? data.masjidId : "",
    masjidName: typeof data.masjidName === "string" ? data.masjidName : "",
    requesterName: typeof data.requesterName === "string" ? data.requesterName : "",
    requesterPhone: typeof data.requesterPhone === "string" ? data.requesterPhone : "",
    requesterEmail: typeof data.requesterEmail === "string" ? data.requesterEmail : undefined,
    role: typeof data.role === "string" ? data.role : "",
    proof: typeof data.proof === "string" ? data.proof : "",
    notes: typeof data.notes === "string" ? data.notes : undefined,
    status,
    createdAt: dateLikeToString(data.createdAt),
    reviewedAt: data.reviewedAt ? dateLikeToString(data.reviewedAt) : undefined,
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
    assignedAdminUid: typeof data.assignedAdminUid === "string" ? data.assignedAdminUid : undefined,
    assignedAdminEmail: typeof data.assignedAdminEmail === "string" ? data.assignedAdminEmail : undefined,
    verificationNotes: typeof data.verificationNotes === "string" ? data.verificationNotes : undefined
  };
}

function normalizeSuggestion(id: string, data: Record<string, unknown>): Suggestion {
  const field = ["jamaat", "jumuah", "facility", "address", "phone", "other"].includes(String(data.field))
    ? (data.field as Suggestion["field"])
    : "other";

  const status = ["pending", "approved", "rejected"].includes(String(data.status))
    ? (data.status as SuggestionStatus)
    : "pending";

  return {
    id,
    masjidId: typeof data.masjidId === "string" ? data.masjidId : "",
    field,
    suggestedValue: typeof data.suggestedValue === "string" ? data.suggestedValue : "",
    notes: typeof data.notes === "string" ? data.notes : undefined,
    status,
    createdAt: dateLikeToString(data.createdAt),
    reviewedAt: data.reviewedAt ? dateLikeToString(data.reviewedAt) : undefined,
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
    masjidSnapshot: data.masjidSnapshot && typeof data.masjidSnapshot === "object"
      ? (data.masjidSnapshot as Suggestion["masjidSnapshot"])
      : undefined
  };
}


function normalizeAdminProfile(id: string, data: Record<string, unknown>): AdminProfile {
  const rawRole = typeof data.role === "string" ? data.role : "masjid_admin";
  const role: AdminRole = rawRole === "owner" || rawRole === "reviewer" || rawRole === "masjid_admin" ? rawRole : "masjid_admin";
  return {
    id,
    email: typeof data.email === "string" ? data.email : undefined,
    role,
    masjidIds: asStringArray(data.masjidIds),
    createdAt: data.createdAt ? dateLikeToString(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? dateLikeToString(data.updatedAt) : undefined,
    createdFromClaimId: typeof data.createdFromClaimId === "string" ? data.createdFromClaimId : undefined
  };
}

export function createDefaultVerificationChecklist(): MasjidVerificationChecklist {
  return {
    nameChecked: false,
    addressChecked: false,
    pinChecked: false,
    routeTested: false,
    timingsChecked: false,
    contactChecked: false
  };
}

export async function listMasjids(): Promise<MasjidListResult> {
  if (!isFirebaseConfigured) {
    return {
      masjids: demoMasjids,
      source: "demo",
      message: "Firebase is not configured yet, so demo masjid data is shown."
    };
  }

  const db = getFirebaseDb();
  if (!db) {
    return { masjids: demoMasjids, source: "demo", message: "Firebase could not start." };
  }

  try {
    const snapshot = await getDocs(collection(db, "masjids"));
    const firebaseMasjids = snapshot.docs
      .map((item) => normalizeMasjid(item.id, item.data()))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!firebaseMasjids.length) {
      return {
        masjids: demoMasjids,
        source: "empty",
        message: "Firebase is connected, but the masjids collection is empty. Use /admin to seed Chennai listings or add your own masjids."
      };
    }

    return { masjids: firebaseMasjids, source: "firebase" };
  } catch (error) {
    return {
      masjids: demoMasjids,
      source: "error",
      message: error instanceof Error ? error.message : "Could not read masjids from Firestore."
    };
  }
}

export async function getMasjid(id: string): Promise<{ masjid?: Masjid; source: MasjidListResult["source"]; message?: string }> {
  if (!isFirebaseConfigured) {
    return { masjid: getDemoMasjidById(id), source: "demo", message: "Firebase is not configured yet." };
  }

  const db = getFirebaseDb();
  if (!db) return { masjid: getDemoMasjidById(id), source: "demo", message: "Firebase could not start." };

  try {
    const snapshot = await getDoc(doc(db, "masjids", id));
    if (!snapshot.exists()) {
      return { masjid: getDemoMasjidById(id), source: "empty", message: "This masjid was not found in Firestore." };
    }
    return { masjid: normalizeMasjid(snapshot.id, snapshot.data()), source: "firebase" };
  } catch (error) {
    return {
      masjid: getDemoMasjidById(id),
      source: "error",
      message: error instanceof Error ? error.message : "Could not load masjid."
    };
  }
}

export async function seedDemoMasjids(): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  await Promise.all(
    demoMasjids.map((masjid) =>
      setDoc(doc(db, "masjids", masjid.id), {
        ...masjidToFirestoreData(masjid),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    )
  );
}

export async function deleteDemoMasjids(): Promise<number> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const knownDemoIds = new Set(demoMasjids.map((masjid) => masjid.id));
  const snapshot = await getDocs(collection(db, "masjids"));
  const demoDocs = snapshot.docs.filter((item) => {
    const data = item.data() as Record<string, unknown>;
    const haystack = `${item.id} ${String(data.name ?? "")} ${String(data.locality ?? "")} ${String(data.address ?? "")}`.toLowerCase();
    return knownDemoIds.has(item.id) || item.id.startsWith("demo-") || haystack.includes("demo") || haystack.includes("sample city");
  });

  await Promise.all(demoDocs.map((item) => deleteDoc(doc(db, "masjids", item.id))));
  await writeAuditLog({
    action: "masjid_deleted",
    targetCollection: "masjids",
    targetId: demoDocs.map((item) => item.id).join(",").slice(0, 500),
    summary: `Deleted ${demoDocs.length} demo masjid listing(s).`
  });

  return demoDocs.length;
}

function validateMasjidForImport(masjid: Masjid): void {
  if (!masjid.id || !/^[a-z0-9-]+$/.test(masjid.id)) {
    throw new Error(`Invalid masjid id "${masjid.id}". Use lowercase letters, numbers, and hyphens only.`);
  }

  if (!masjid.name?.trim()) throw new Error(`Masjid ${masjid.id} is missing a name.`);
  if (!masjid.locality?.trim()) throw new Error(`Masjid ${masjid.id} is missing a locality.`);
  if (!masjid.address?.trim()) throw new Error(`Masjid ${masjid.id} is missing an address.`);

  if (typeof masjid.coordinates?.lat !== "number" || typeof masjid.coordinates?.lng !== "number") {
    throw new Error(`Masjid ${masjid.id} is missing numeric coordinates.lat / coordinates.lng.`);
  }

  for (const salah of salahKeys) {
    if (!/^\d{2}:\d{2}$/.test(masjid.jamaat?.[salah])) {
      throw new Error(`Masjid ${masjid.id} has invalid ${salah} time. Use HH:MM format.`);
    }
  }
}

export async function upsertMasjids(masjids: Masjid[], updatedBy?: string): Promise<number> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  if (!Array.isArray(masjids) || masjids.length === 0) {
    throw new Error("Import requires at least one masjid.");
  }

  for (const masjid of masjids) validateMasjidForImport(masjid);

  await Promise.all(
    masjids.map((masjid) =>
      setDoc(
        doc(db, "masjids", masjid.id),
        {
          ...masjidToFirestoreData(masjid),
          updatedAt: serverTimestamp(),
          updatedBy: updatedBy ?? null
        },
        { merge: true }
      )
    )
  );

  await writeAuditLog({
    action: "masjid_upsert",
    targetCollection: "masjids",
    targetId: masjids.map((masjid) => masjid.id).join(",").slice(0, 500),
    summary: `Upserted ${masjids.length} masjid listing(s).`,
    actorId: updatedBy
  });

  return masjids.length;
}

export async function seedChennaiStarterMasjids(updatedBy?: string): Promise<number> {
  return upsertMasjids(chennaiStarterMasjids, updatedBy);
}

export async function deleteChennaiStarterMasjids(): Promise<number> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const starterIds = chennaiStarterMasjids.map((masjid) => masjid.id);
  await Promise.all(starterIds.map((id) => deleteDoc(doc(db, "masjids", id))));
  await writeAuditLog({
    action: "masjid_deleted",
    targetCollection: "masjids",
    targetId: starterIds.join(",").slice(0, 500),
    summary: `Deleted ${starterIds.length} Chennai starter listing(s).`
  });

  return starterIds.length;
}

export async function updateMasjidCurrentTimings(
  masjidId: string,
  update: TimingUpdate,
  updatedBy?: string
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  for (const salah of salahKeys) {
    if (!/^\d{2}:\d{2}$/.test(update.jamaat[salah])) {
      throw new Error(`Invalid ${salah} time. Use HH:MM format.`);
    }
  }

  const today = todayDateId();

  await setDoc(
    doc(db, "masjids", masjidId),
    {
      jamaat: update.jamaat,
      jumuah: update.jumuah,
      verificationStatus: "admin_verified",
      lastVerifiedAt: today,
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy ?? null
    },
    { merge: true }
  );

  await setDoc(doc(db, "jamaatTimings", `${masjidId}_${today}`), {
    masjidId,
    date: today,
    ...update,
    source: "admin",
    updatedAt: serverTimestamp(),
    updatedBy: updatedBy ?? null
  });

  await writeAuditLog({
    action: "timing_update",
    targetCollection: "masjids",
    targetId: masjidId,
    summary: `Updated verified jamaat timings for ${masjidId}.`,
    actorId: updatedBy
  });
}

export async function createSuggestion(input: SuggestionInput): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const document = await addDoc(collection(db, "suggestions"), {
    ...input,
    status: "pending",
    createdAt: serverTimestamp()
  });

  return document.id;
}

export async function listSuggestions(status: SuggestionStatus | "all" = "pending"): Promise<Suggestion[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const snapshot = await getDocs(collection(db, "suggestions"));
  return snapshot.docs
    .map((item) => normalizeSuggestion(item.id, item.data()))
    .filter((suggestion) => status === "all" || suggestion.status === status)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function rejectSuggestion(suggestionId: string, reviewedBy?: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  await setDoc(
    doc(db, "suggestions", suggestionId),
    {
      status: "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewedBy ?? null
    },
    { merge: true }
  );
  await writeAuditLog({
    action: "suggestion_rejected",
    targetCollection: "suggestions",
    targetId: suggestionId,
    summary: `Rejected suggestion ${suggestionId}.`,
    actorId: reviewedBy
  });
}


export async function markSuggestionReviewed(suggestionId: string, reviewedBy?: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  await setDoc(
    doc(db, "suggestions", suggestionId),
    {
      status: "approved",
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewedBy ?? null
    },
    { merge: true }
  );
  await writeAuditLog({
    action: "suggestion_approved",
    targetCollection: "suggestions",
    targetId: suggestionId,
    summary: `Marked suggestion ${suggestionId} as approved.`,
    actorId: reviewedBy
  });
}

export async function approveSuggestion(suggestion: Suggestion, reviewedBy?: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const masjidRef = doc(db, "masjids", suggestion.masjidId);
  const masjidSnapshot = await getDoc(masjidRef);
  if (!masjidSnapshot.exists()) throw new Error("The masjid for this suggestion was not found.");

  const currentMasjid = normalizeMasjid(masjidSnapshot.id, masjidSnapshot.data());
  const value = suggestion.suggestedValue.trim();
  const today = todayDateId();

  let patch: Record<string, unknown> = {
    verificationStatus: "community_checked",
    lastVerifiedAt: today,
    updatedAt: serverTimestamp(),
    updatedBy: reviewedBy ?? null
  };

  if (suggestion.field === "phone") {
    patch.phone = value;
  } else if (suggestion.field === "address") {
    patch.address = value;
  } else if (suggestion.field === "facility") {
    patch.facilities = uniqueStrings([...currentMasjid.facilities, value]);
  } else if (suggestion.field === "jumuah") {
    const jumuah = parseJumuahTimes(value);
    if (!jumuah.length) throw new Error("Could not read Jumu’ah timings from the suggestion.");
    patch.jumuah = jumuah;
  } else if (suggestion.field === "jamaat") {
    const salah = detectSalah(value);
    const time = parseLooseTime(value);
    if (!salah || !time) {
      throw new Error("For jamaat suggestions, use text like: Asr 17:20 or Fajr 5:10 AM.");
    }
    patch.jamaat = { ...currentMasjid.jamaat, [salah]: time };
  } else {
    patch.notes = uniqueStrings([
      currentMasjid.notes ?? "",
      `Community note reviewed on ${today}: ${value}${suggestion.notes ? ` — ${suggestion.notes}` : ""}`
    ]).join("\n");
  }

  await setDoc(masjidRef, patch, { merge: true });
  await setDoc(
    doc(db, "suggestions", suggestion.id),
    {
      status: "approved",
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewedBy ?? null
    },
    { merge: true }
  );
  await writeAuditLog({
    action: "suggestion_approved",
    targetCollection: "suggestions",
    targetId: suggestion.id,
    summary: `Applied and approved ${suggestion.field} suggestion for ${suggestion.masjidId}.`,
    actorId: reviewedBy
  });
}


export async function createClaimRequest(input: ClaimRequestInput): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const document = await addDoc(collection(db, "claimRequests"), {
    ...input,
    status: "pending",
    createdAt: serverTimestamp()
  });

  return document.id;
}

export async function listClaimRequests(status: ClaimStatus | "all" = "pending"): Promise<ClaimRequest[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const snapshot = await getDocs(collection(db, "claimRequests"));
  return snapshot.docs
    .map((item) => normalizeClaimRequest(item.id, item.data()))
    .filter((claim) => status === "all" || claim.status === status)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function updateClaimRequestStatus(
  claimId: string,
  status: ClaimStatus,
  reviewedBy?: string
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  await setDoc(
    doc(db, "claimRequests", claimId),
    {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewedBy ?? null
    },
    { merge: true }
  );
  await writeAuditLog({
    action: "claim_status_changed",
    targetCollection: "claimRequests",
    targetId: claimId,
    summary: `Claim request ${claimId} changed to ${status}.`,
    actorId: reviewedBy
  });
}
export async function listAdminProfiles(): Promise<AdminProfile[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");

  const snapshot = await getDocs(collection(db, "admins"));
  return snapshot.docs
    .map((item) => normalizeAdminProfile(item.id, item.data()))
    .sort((a, b) => (a.email ?? a.id).localeCompare(b.email ?? b.id));
}

export async function upsertAdminProfile(profile: AdminProfile, actorId?: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");
  if (!profile.id.trim()) throw new Error("Firebase Auth UID is required for an admin profile.");

  await setDoc(
    doc(db, "admins", profile.id),
    {
      email: profile.email ?? null,
      role: profile.role,
      masjidIds: uniqueStrings(profile.masjidIds ?? []),
      createdFromClaimId: profile.createdFromClaimId ?? null,
      updatedAt: serverTimestamp(),
      createdAt: profile.createdAt ?? serverTimestamp()
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "admin_profile_upsert",
    targetCollection: "admins",
    targetId: profile.id,
    summary: `Upserted ${profile.role} admin profile for ${profile.email ?? profile.id}.`,
    actorId
  });
}

export async function verifyMasjidListing(input: {
  masjidId: string;
  status: VerificationStatus;
  checklist: MasjidVerificationChecklist;
  notes?: string;
  verifiedBy?: string;
  assignedAdminIds?: string[];
}): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");
  if (!input.masjidId.trim()) throw new Error("Masjid ID is required.");

  const navigationVerified = checklistComplete(input.checklist);
  const today = todayDateId();

  await setDoc(
    doc(db, "masjids", input.masjidId),
    {
      verificationStatus: input.status,
      verificationChecklist: input.checklist,
      navigationVerified,
      verificationNotes: input.notes?.trim() || null,
      verifiedBy: input.verifiedBy ?? null,
      assignedAdminIds: uniqueStrings(input.assignedAdminIds ?? []),
      lastVerifiedAt: today,
      lastNavigationTestAt: input.checklist.routeTested ? today : null,
      updatedAt: serverTimestamp(),
      updatedBy: input.verifiedBy ?? null
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "masjid_verified",
    targetCollection: "masjids",
    targetId: input.masjidId,
    summary: navigationVerified
      ? `Verified ${input.masjidId} with route-tested navigation.`
      : `Updated verification for ${input.masjidId}; direct navigation remains locked until checklist is complete.`,
    actorId: input.verifiedBy
  });
}

export async function approveClaimAndAssignAdmin(input: {
  claimId: string;
  masjidId: string;
  adminUid: string;
  adminEmail?: string;
  notes?: string;
  reviewedBy?: string;
}): Promise<void> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured. Add .env.local first.");
  if (!input.claimId.trim()) throw new Error("Claim ID is required.");
  if (!input.masjidId.trim()) throw new Error("Masjid ID is required.");
  if (!input.adminUid.trim()) throw new Error("Firebase Auth UID is required before a claim can be assigned.");

  const adminRef = doc(db, "admins", input.adminUid);
  const existingAdmin = await getDoc(adminRef);
  const existingMasjidIds = existingAdmin.exists() ? asStringArray(existingAdmin.data().masjidIds) : [];
  const nextMasjidIds = uniqueStrings([...existingMasjidIds, input.masjidId]);

  await setDoc(
    adminRef,
    {
      email: input.adminEmail ?? existingAdmin.data()?.email ?? null,
      role: "masjid_admin",
      masjidIds: nextMasjidIds,
      createdFromClaimId: input.claimId,
      updatedAt: serverTimestamp(),
      createdAt: existingAdmin.exists() ? existingAdmin.data()?.createdAt ?? serverTimestamp() : serverTimestamp()
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "claimRequests", input.claimId),
    {
      status: "approved",
      reviewedAt: serverTimestamp(),
      reviewedBy: input.reviewedBy ?? null,
      assignedAdminUid: input.adminUid,
      assignedAdminEmail: input.adminEmail ?? null,
      verificationNotes: input.notes?.trim() || null
    },
    { merge: true }
  );

  const masjidSnapshot = await getDoc(doc(db, "masjids", input.masjidId));
  const existingAssignedAdmins = masjidSnapshot.exists() ? asStringArray(masjidSnapshot.data().assignedAdminIds) : [];

  await setDoc(
    doc(db, "masjids", input.masjidId),
    {
      assignedAdminIds: uniqueStrings([...existingAssignedAdmins, input.adminUid]),
      updatedAt: serverTimestamp(),
      updatedBy: input.reviewedBy ?? null
    },
    { merge: true }
  );

  await writeAuditLog({
    action: "claim_approved_assigned",
    targetCollection: "claimRequests",
    targetId: input.claimId,
    summary: `Approved claim ${input.claimId} and assigned ${input.adminUid} to ${input.masjidId}.`,
    actorId: input.reviewedBy
  });
}

