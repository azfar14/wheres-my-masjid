"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { useMasjids } from "@/hooks/useMasjids";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import {
  approveSuggestion,
  deleteChennaiStarterMasjids,
  deleteDemoMasjids,
  listClaimRequests,
  listSuggestions,
  markSuggestionReviewed,
  parseJumuahTimes,
  rejectSuggestion,
  seedChennaiStarterMasjids,
  seedDemoMasjids,
  updateClaimRequestStatus,
  updateMasjidCurrentTimings,
  upsertMasjids
} from "@/lib/masjidService";
import { chennaiStarterMasjidsJson } from "@/lib/chennaiMasjids";
import { salahDisplayNames, salahOrder } from "@/lib/jamaat";
import { launchReadinessFor, parseGoogleMapsCoordinates } from "@/lib/launchVerification";
import type { ClaimRequest, Masjid, SalahKey, Suggestion, VerificationStatus } from "@/types";

const emptyJamaat: Record<SalahKey, string> = {
  fajr: "05:10",
  dhuhr: "13:30",
  asr: "17:15",
  maghrib: "18:44",
  isha: "20:15"
};

type ListingForm = {
  id: string;
  name: string;
  locality: string;
  address: string;
  lat: string;
  lng: string;
  phone: string;
  facilitiesText: string;
  languagesText: string;
  verificationStatus: VerificationStatus;
  notes: string;
  mapsLink: string;
  jamaat: Record<SalahKey, string>;
  jumuahText: string;
};

function blankListingForm(): ListingForm {
  return {
    id: "",
    name: "",
    locality: "",
    address: "",
    lat: "",
    lng: "",
    phone: "",
    facilitiesText: "Wudu",
    languagesText: "Tamil, Urdu",
    verificationStatus: "demo_unverified",
    notes: "",
    mapsLink: "",
    jamaat: emptyJamaat,
    jumuahText: "13:15"
  };
}

function masjidToForm(masjid: Masjid): ListingForm {
  return {
    id: masjid.id,
    name: masjid.name,
    locality: masjid.locality,
    address: masjid.address,
    lat: String(masjid.coordinates.lat),
    lng: String(masjid.coordinates.lng),
    phone: masjid.phone ?? "",
    facilitiesText: masjid.facilities.join(", "),
    languagesText: masjid.khutbahLanguages.join(", "),
    verificationStatus: masjid.verificationStatus,
    notes: masjid.notes ?? "",
    mapsLink: "",
    jamaat: masjid.jamaat,
    jumuahText: masjid.jumuah.join(" / ")
  };
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMasjidImportPayload(value: string): Masjid[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Paste a JSON array of masjid objects.");
  }
  return parsed as Masjid[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function buildMasjidFromForm(form: ListingForm): Masjid {
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  const id = slugify(form.id || form.name);

  if (!id) throw new Error("Add a masjid ID or name first.");
  if (!form.name.trim()) throw new Error("Masjid name is required.");
  if (!form.locality.trim()) throw new Error("Locality is required.");
  if (!form.address.trim()) throw new Error("Address is required.");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Latitude and longitude must be valid numbers.");

  for (const salah of salahOrder) {
    if (!/^\d{2}:\d{2}$/.test(form.jamaat[salah])) {
      throw new Error(`Invalid ${salahDisplayNames[salah]} time. Use HH:MM format.`);
    }
  }

  return {
    id,
    name: form.name.trim(),
    locality: form.locality.trim(),
    address: form.address.trim(),
    coordinates: { lat, lng },
    phone: form.phone.trim() || undefined,
    facilities: parseList(form.facilitiesText),
    khutbahLanguages: parseList(form.languagesText),
    verificationStatus: form.verificationStatus,
    lastVerifiedAt: new Date().toISOString().slice(0, 10),
    jamaat: form.jamaat,
    jumuah: parseJumuahTimes(form.jumuahText),
    notes: form.notes.trim() || undefined,
    source: "firestore"
  };
}

export default function AdminPage() {
  const { masjids, source, message, isLoading, refresh } = useMasjids({ includeLegacyDemoRecords: true });
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedMasjidId, setSelectedMasjidId] = useState("");
  const [jamaat, setJamaat] = useState<Record<SalahKey, string>>(emptyJamaat);
  const [jumuahText, setJumuahText] = useState("13:15");
  const [listingForm, setListingForm] = useState<ListingForm>(() => blankListingForm());
  const [importText, setImportText] = useState(chennaiStarterMasjidsJson);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [adminWarnings, setAdminWarnings] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const selectedMasjid = useMemo(
    () => masjids.find((masjid) => masjid.id === selectedMasjidId),
    [masjids, selectedMasjidId]
  );

  const pendingDemoCount = useMemo(
    () => masjids.filter((masjid) => masjid.id.startsWith("demo-")).length,
    [masjids]
  );

  const chennaiStarterCount = useMemo(
    () => masjids.filter((masjid) => masjid.verificationStatus === "demo_unverified" && /chennai/i.test(`${masjid.locality} ${masjid.address}`)).length,
    [masjids]
  );

  const verifiedCount = useMemo(
    () => masjids.filter((masjid) => masjid.verificationStatus === "admin_verified").length,
    [masjids]
  );

  const needsVerificationCount = useMemo(
    () => masjids.filter((masjid) => masjid.verificationStatus !== "admin_verified" && masjid.verificationStatus !== "community_checked").length,
    [masjids]
  );

  const launchReadiness = useMemo(() => launchReadinessFor(masjids), [masjids]);

  const loadPendingSuggestions = useCallback(async () => {
    if (!user || !isFirebaseConfigured) return;
    setSuggestionsLoading(true);
    try {
      const pending = await listSuggestions("pending");
      setSuggestions(pending);
    } catch (suggestionError) {
      const message = suggestionError instanceof Error ? suggestionError.message : "Could not load suggestions.";
      setAdminWarnings((current) => Array.from(new Set([...current, `Suggestions inbox needs Firestore rule access: ${message}`])));
    } finally {
      setSuggestionsLoading(false);
    }
  }, [user]);

  const loadPendingClaims = useCallback(async () => {
    if (!user || !isFirebaseConfigured) return;
    setClaimsLoading(true);
    try {
      const pending = await listClaimRequests("pending");
      setClaims(pending);
    } catch (claimError) {
      const message = claimError instanceof Error ? claimError.message : "Could not load claim requests.";
      setAdminWarnings((current) => Array.from(new Set([...current, `Claim inbox needs Firestore rule access: ${message}`])));
    } finally {
      setClaimsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedMasjidId && masjids.length) {
      setSelectedMasjidId(masjids[0].id);
    }
  }, [masjids, selectedMasjidId]);

  useEffect(() => {
    if (!selectedMasjid) return;
    setJamaat(selectedMasjid.jamaat);
    setJumuahText(selectedMasjid.jumuah.join(" / "));
    setListingForm(masjidToForm(selectedMasjid));
  }, [selectedMasjid]);

  useEffect(() => {
    loadPendingSuggestions();
    loadPendingClaims();
  }, [loadPendingClaims, loadPendingSuggestions]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);

    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase is not configured yet. Add .env.local first.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
      setStatus("Logged in successfully.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
    }
  }

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }

  async function handleSeedDemoData() {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      await seedDemoMasjids();
      await refresh();
      setStatus("Old demo masjids seeded into Firestore. Use this only for testing fallback UI.");
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Could not seed demo masjids.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteDemoData() {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      const count = await deleteDemoMasjids();
      await refresh();
      setStatus(`Removed ${count} old demo masjid listing${count === 1 ? "" : "s"} from Firestore.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove demo masjids.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSeedChennaiData() {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      const count = await seedChennaiStarterMasjids(user?.uid);
      await refresh();
      setStatus(`${count} Chennai masjid listings imported. Their jamaat timings are marked as needing verification.`);
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "Could not seed Chennai masjids.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteChennaiStarterData() {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      const count = await deleteChennaiStarterMasjids();
      await refresh();
      setStatus(`Removed ${count} Chennai starter listing${count === 1 ? "" : "s"}. Public pages are location-first, but this also cleans the database.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove Chennai starter listings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      const masjidsToImport = parseMasjidImportPayload(importText);
      const count = await upsertMasjids(masjidsToImport, user?.uid);
      await refresh();
      setStatus(`${count} masjid listing${count === 1 ? "" : "s"} imported into Firestore.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import masjids.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleApplyMapsLink() {
    setError(undefined);
    const coordinates = parseGoogleMapsCoordinates(listingForm.mapsLink);
    if (!coordinates) {
      setError("Could not find coordinates in that Maps link. Copy a Google Maps link containing @lat,lng or paste coordinates like 13.0827,80.2707.");
      return;
    }

    setListingForm((current) => ({
      ...current,
      lat: coordinates.lat.toFixed(7),
      lng: coordinates.lng.toFixed(7),
      verificationStatus: current.verificationStatus === "demo_unverified" ? "community_checked" : current.verificationStatus,
      notes: [current.notes, `Exact pin extracted from Google Maps on ${new Date().toISOString().slice(0, 10)}.`].filter(Boolean).join("\n")
    }));
    setStatus("Exact coordinates copied. Test Google navigation before marking this listing admin verified.");
  }

  async function handleSaveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      const masjid = buildMasjidFromForm(listingForm);
      await upsertMasjids([masjid], user?.uid);
      await refresh();
      setSelectedMasjidId(masjid.id);
      setStatus(`Saved listing for ${masjid.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save masjid listing.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveTimings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);

    if (!selectedMasjid) {
      setError("Select a masjid first.");
      return;
    }

    setIsSaving(true);
    try {
      await updateMasjidCurrentTimings(
        selectedMasjid.id,
        { jamaat, jumuah: parseJumuahTimes(jumuahText) },
        user?.uid
      );
      await refresh();
      setStatus(`Saved verified jamaat timings for ${selectedMasjid.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save timings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApproveSuggestion(suggestion: Suggestion) {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      await approveSuggestion(suggestion, user?.uid);
      await refresh();
      await loadPendingSuggestions();
      setStatus("Suggestion approved and applied to the masjid listing.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Could not approve suggestion.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRejectSuggestion(suggestionId: string) {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      await rejectSuggestion(suggestionId, user?.uid);
      await loadPendingSuggestions();
      setStatus("Suggestion rejected.");
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Could not reject suggestion.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkSuggestionReviewed(suggestionId: string) {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      await markSuggestionReviewed(suggestionId, user?.uid);
      await loadPendingSuggestions();
      setStatus("Suggestion marked as reviewed. Apply any real listing changes separately.");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not mark suggestion as reviewed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClaimStatus(claimId: string, nextStatus: "approved" | "rejected") {
    setError(undefined);
    setStatus(undefined);
    setIsSaving(true);

    try {
      await updateClaimRequestStatus(claimId, nextStatus, user?.uid);
      await loadPendingClaims();
      setStatus(nextStatus === "approved" ? "Claim request approved. Create/assign a real admin account next." : "Claim request rejected.");
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not update claim request.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateListingFromSuggestion(suggestion: Suggestion) {
    setError(undefined);
    setStatus(undefined);

    if (!suggestion.masjidSnapshot) {
      setError("This suggestion does not include a masjid snapshot to import.");
      return;
    }

    setIsSaving(true);
    try {
      const snapshot = suggestion.masjidSnapshot;
      const masjid: Masjid = {
        id: slugify(snapshot.id || snapshot.name),
        name: snapshot.name,
        locality: snapshot.locality,
        address: snapshot.address,
        coordinates: snapshot.coordinates,
        phone: undefined,
        facilities: [],
        khutbahLanguages: [],
        verificationStatus: "demo_unverified",
        lastVerifiedAt: new Date().toISOString().slice(0, 10),
        jamaat: emptyJamaat,
        jumuah: [],
        notes: `Imported from ${snapshot.source ?? "community suggestion"}. Verify details and jamaat timings before marking as verified.`,
        source: "firestore",
        osm: snapshot.osm,
        osmConfidence: snapshot.osmConfidence,
        googlePlaceId: snapshot.googlePlaceId,
        googleMapsUri: snapshot.googleMapsUri,
        discoveryQuality: snapshot.discoveryQuality
      };

      await upsertMasjids([masjid], user?.uid);
      await refresh();
      setSelectedMasjidId(masjid.id);
      setStatus(`Created Firestore listing for ${masjid.name}. Now verify timings and save.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create listing from suggestion.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card">
          <p className="kicker">Admin MVP+</p>
          <h2 className="hero-title">Manage listings, timings, and community corrections.</h2>
          <div className="hero-meta">
            <span className="pill">{masjids.length} masjids</span>
            <span className="pill">{suggestions.length} suggestions</span>
            <span className="pill">{claims.length} claims</span>
          </div>
        </section>

        <DataStatus source={source} message={message} isLoading={isLoading} />

        <section className="notice neutral compact admin-qa-strip">
          Before public testing, use <Link href="/qa">Production QA</Link> with real coordinates. It shows provider counts, accepted/rejected candidates, errors, and launch readiness for that location.
        </section>

        {status && <div className="notice success">{status}</div>}
        {error && <div className="notice danger">{error}</div>}
        {adminWarnings.length > 0 && (
          <div className="notice danger">
            <strong>Firestore rules need updating.</strong> Publish the included <strong>firestore.rules</strong> file in Firebase Console.
            <ul className="tight-list">
              {adminWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}

        {!isFirebaseConfigured && (
          <div className="notice danger">
            Firebase is not configured yet. Copy <strong>.env.local.example</strong> to <strong>.env.local</strong> and add your Firebase web config.
          </div>
        )}

        {isFirebaseConfigured && authReady && !user && (
          <form className="form-card" onSubmit={handleLogin}>
            <h3>Admin login</h3>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="admin@example.com" required />
            </label>
            <label>
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </label>
            <button className="button full" type="submit">Login</button>
            <p className="small-text">Create this admin user inside Firebase Authentication first.</p>
          </form>
        )}

        {isFirebaseConfigured && user && (
          <>
            <section className="info-card admin-top">
              <div>
                <h3>Signed in</h3>
                <p>{user.email}</p>
              </div>
              <button className="ghost-button" type="button" onClick={handleLogout}>Logout</button>
            </section>

            <section className="info-card">
              <h3>Product control center</h3>
              <div className="meta-grid">
                <div className="meta-item"><span>Total listings</span><strong>{masjids.length}</strong></div>
                <div className="meta-item"><span>Admin verified</span><strong>{verifiedCount}</strong></div>
                <div className="meta-item"><span>Need work</span><strong>{needsVerificationCount}</strong></div>
              </div>
              <p className="small-text">Growth loop: users report missing masjids → admins create exact listings → committees claim listings → jamaat timings become verified.</p>
              <div className="card-actions three-actions">
                <Link className="ghost-button" href="/missing">Missing report</Link>
                <Link className="secondary-button" href="/admin/verification">Verify + assign</Link>
                <Link className="ghost-button" href="/admin/analytics">Analytics</Link>
                <Link className="ghost-button" href="/admin/data-pipeline">Data pipeline</Link>
                <Link className="ghost-button" href="/qibla">Qibla</Link>
              </div>
            </section>

            <section className="info-card launch-readiness-card">
              <div className="section-inline-head">
                <div>
                  <h3>Pre-launch trust gate</h3>
                  <p className="small-text">Direct navigation is trusted only for verified Firestore masjids. External provider results must be verified first.</p>
                </div>
                <div className="cta-row"><Link className="ghost-button" href="/launch">Launch checklist</Link><Link className="secondary-button" href="/admin/verification">Verification + claims</Link></div>
              </div>
              <div className="meta-grid">
                <div className="meta-item"><span>Launch score</span><strong>{launchReadiness.score}/100</strong></div>
                <div className="meta-item"><span>Verified pins</span><strong>{launchReadiness.verifiedCount}</strong></div>
                <div className="meta-item"><span>Verified timings</span><strong>{launchReadiness.verifiedWithTimingsCount}</strong></div>
              </div>
              <div className="notice compact warning-soft">
                <strong>Navigation lock:</strong> unverified external pins open Google Maps search first. Direct turn-by-turn navigation is reserved for verified listings and Google place IDs.
              </div>
              <ul className="tight-list">
                {launchReadiness.messages.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section className="form-card">
              <h3>Clean data and starter imports</h3>
              <p className="small-text">
                You currently have {masjids.length} Firestore listing{masjids.length === 1 ? "" : "s"}. Public pages now hide all listings until a user gives a location, then show only radius-matched masjids with distance. Chennai starter detected: {chennaiStarterCount}. {pendingDemoCount > 0 ? `${pendingDemoCount} old demo listing${pendingDemoCount === 1 ? "" : "s"} can be removed.` : "No old demo listing is detected."}
              </p>
              <button className="button full" type="button" onClick={handleSeedChennaiData} disabled={isSaving}>
                {isSaving ? "Working…" : "Seed 5 Chennai masjids for testing"}
              </button>
              <button className="secondary-button full" type="button" onClick={handleDeleteChennaiStarterData} disabled={isSaving || chennaiStarterCount === 0}>
                {isSaving ? "Working…" : "Remove Chennai starter listings"}
              </button>
              <button className="secondary-button full" type="button" onClick={handleDeleteDemoData} disabled={isSaving || pendingDemoCount === 0}>
                {isSaving ? "Working…" : "Remove old demo masjids"}
              </button>
              <details>
                <summary>Advanced: seed old demo masjids again</summary>
                <p className="small-text">Only use this if you want to test the fallback demo UI again.</p>
                <button className="ghost-button full" type="button" onClick={handleSeedDemoData} disabled={isSaving}>
                  Seed old demo masjids
                </button>
              </details>
            </section>

            <form className="form-card" onSubmit={handleBulkImport}>
              <h3>Bulk import masjids</h3>
              <p className="small-text">Paste a JSON array here and import many masjids at once. This avoids adding Firestore fields one by one.</p>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={12}
                spellCheck={false}
              />
              <div className="cta-row">
                <button className="ghost-button" type="button" onClick={() => setImportText(chennaiStarterMasjidsJson)}>
                  Load Chennai sample
                </button>
                <button className="secondary-button" type="submit" disabled={isSaving}>
                  {isSaving ? "Importing…" : "Import JSON"}
                </button>
              </div>
            </form>

            <form className="form-card" onSubmit={handleSaveListing}>
              <h3>Add / edit masjid listing</h3>
              <p className="small-text">Use this form instead of manually creating Firestore fields.</p>
              <div className="cta-row">
                <button className="ghost-button" type="button" onClick={() => setListingForm(blankListingForm())}>
                  New listing
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!selectedMasjid}
                  onClick={() => selectedMasjid && setListingForm(masjidToForm(selectedMasjid))}
                >
                  Load selected
                </button>
              </div>

              <label>
                Masjid ID
                <input
                  value={listingForm.id}
                  onChange={(event) => setListingForm((current) => ({ ...current, id: slugify(event.target.value) }))}
                  placeholder="masjid-e-noor"
                  required
                />
              </label>
              <label>
                Masjid name
                <input
                  value={listingForm.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setListingForm((current) => {
                      const idWasAutoGenerated = !current.id || current.id === slugify(current.name);
                      return { ...current, name, id: idWasAutoGenerated ? slugify(name) : current.id };
                    });
                  }}
                  placeholder="Masjid-e-Noor"
                  required
                />
              </label>
              <label>
                Locality
                <input
                  value={listingForm.locality}
                  onChange={(event) => setListingForm((current) => ({ ...current, locality: event.target.value }))}
                  placeholder="Triplicane, Chennai"
                  required
                />
              </label>
              <label>
                Address
                <textarea
                  value={listingForm.address}
                  onChange={(event) => setListingForm((current) => ({ ...current, address: event.target.value }))}
                  required
                />
              </label>
              <label>
                Google Maps link / copied coordinates for exact pin
                <textarea
                  value={listingForm.mapsLink}
                  onChange={(event) => setListingForm((current) => ({ ...current, mapsLink: event.target.value }))}
                  placeholder="Paste a Google Maps link with @lat,lng or paste coordinates like 13.0827,80.2707"
                  rows={3}
                />
              </label>
              <button className="ghost-button full" type="button" onClick={handleApplyMapsLink}>
                Extract exact pin from Maps link
              </button>
              <div className="notice compact neutral">
                For safest navigation, verify the pin in Google Maps, paste the exact coordinates here, save the listing, test the route, then mark it admin verified.
              </div>
              <div className="field-grid">
                <label>
                  Latitude
                  <input
                    value={listingForm.lat}
                    onChange={(event) => setListingForm((current) => ({ ...current, lat: event.target.value }))}
                    placeholder="13.055"
                    required
                  />
                </label>
                <label>
                  Longitude
                  <input
                    value={listingForm.lng}
                    onChange={(event) => setListingForm((current) => ({ ...current, lng: event.target.value }))}
                    placeholder="80.255"
                    required
                  />
                </label>
              </div>
              <label>
                Phone
                <input
                  value={listingForm.phone}
                  onChange={(event) => setListingForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+91XXXXXXXXXX"
                />
              </label>
              <label>
                Facilities
                <input
                  value={listingForm.facilitiesText}
                  onChange={(event) => setListingForm((current) => ({ ...current, facilitiesText: event.target.value }))}
                  placeholder="Wudu, Parking, Ladies section"
                />
              </label>
              <label>
                Khutbah languages
                <input
                  value={listingForm.languagesText}
                  onChange={(event) => setListingForm((current) => ({ ...current, languagesText: event.target.value }))}
                  placeholder="Tamil, Urdu, Arabic"
                />
              </label>
              <label>
                Verification status
                <select
                  value={listingForm.verificationStatus}
                  onChange={(event) => setListingForm((current) => ({ ...current, verificationStatus: event.target.value as VerificationStatus }))}
                >
                  <option value="demo_unverified">Needs verification</option>
                  <option value="community_checked">Community checked</option>
                  <option value="admin_verified">Admin verified</option>
                </select>
              </label>

              {salahOrder.map((salah) => (
                <label key={`listing-${salah}`}>
                  {salahDisplayNames[salah]} jamaat
                  <input
                    type="time"
                    value={listingForm.jamaat[salah]}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        jamaat: { ...current.jamaat, [salah]: event.target.value }
                      }))
                    }
                    required
                  />
                </label>
              ))}

              <label>
                Jumu’ah timings
                <input
                  value={listingForm.jumuahText}
                  onChange={(event) => setListingForm((current) => ({ ...current, jumuahText: event.target.value }))}
                  placeholder="13:15 / 14:00"
                />
              </label>
              <label>
                Notes
                <textarea
                  value={listingForm.notes}
                  onChange={(event) => setListingForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Verification source, notice-board note, admin contact, etc."
                />
              </label>

              <button className="button full" type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save masjid listing"}
              </button>
            </form>

            <form className="form-card" onSubmit={handleSaveTimings}>
              <h3>Quick update jamaat timings</h3>
              <label>
                Masjid
                <select value={selectedMasjidId} onChange={(event) => setSelectedMasjidId(event.target.value)}>
                  {masjids.map((masjid) => (
                    <option value={masjid.id} key={masjid.id}>{masjid.name}</option>
                  ))}
                </select>
              </label>

              {salahOrder.map((salah) => (
                <label key={salah}>
                  {salahDisplayNames[salah]} jamaat
                  <input
                    type="time"
                    value={jamaat[salah]}
                    onChange={(event) => setJamaat((current) => ({ ...current, [salah]: event.target.value }))}
                    required
                  />
                </label>
              ))}

              <label>
                Jumu’ah timings
                <input
                  value={jumuahText}
                  onChange={(event) => setJumuahText(event.target.value)}
                  placeholder="13:15 / 14:00"
                />
              </label>

              <button className="button full" type="submit" disabled={isSaving || !selectedMasjid}>
                {isSaving ? "Saving…" : "Save verified timings"}
              </button>
            </form>

            <section className="form-card">
              <div className="section-inline-head">
                <div>
                  <h3>Masjid claim requests</h3>
                  <p className="small-text">Verify committee/admin requests before giving anyone edit access.</p>
                </div>
                <button className="ghost-button" type="button" onClick={loadPendingClaims} disabled={claimsLoading}>
                  {claimsLoading ? "Loading…" : "Refresh"}
                </button>
              </div>

              {claims.length === 0 && <div className="notice neutral">No pending claim requests yet.</div>}

              {claims.map((claim) => (
                <article className="suggestion-card" key={claim.id}>
                  <div>
                    <strong>{claim.masjidName || claim.masjidId}</strong>
                    <p className="small-text">{claim.role} · submitted {claim.createdAt ?? "recently"}</p>
                  </div>
                  <p><strong>Requester:</strong> {claim.requesterName} · {claim.requesterPhone}{claim.requesterEmail ? ` · ${claim.requesterEmail}` : ""}</p>
                  <p><strong>Proof:</strong> {claim.proof}</p>
                  {claim.notes && <p><strong>Notes:</strong> {claim.notes}</p>}
                  <div className="cta-row">
                    <button className="secondary-button" type="button" onClick={() => handleClaimStatus(claim.id, "approved")} disabled={isSaving}>Approve</button>
                    <button className="ghost-button" type="button" onClick={() => handleClaimStatus(claim.id, "rejected")} disabled={isSaving}>Reject</button>
                  </div>
                </article>
              ))}
            </section>

            <section className="form-card">
              <div className="section-inline-head">
                <div>
                  <h3>Suggestion review inbox</h3>
                  <p className="small-text">Approve useful corrections or reject noisy ones.</p>
                </div>
                <button className="ghost-button" type="button" onClick={loadPendingSuggestions} disabled={suggestionsLoading}>
                  {suggestionsLoading ? "Loading…" : "Refresh"}
                </button>
              </div>

              {suggestions.length === 0 && (
                <div className="notice neutral">No pending suggestions yet.</div>
              )}

              {suggestions.map((suggestion) => {
                const masjid = masjids.find((item) => item.id === suggestion.masjidId);
                return (
                  <article className="suggestion-card" key={suggestion.id}>
                    <div>
                      <strong>{masjid?.name ?? suggestion.masjidSnapshot?.name ?? suggestion.masjidId}</strong>
                      <p className="small-text">{suggestion.field} · submitted {suggestion.createdAt ?? "recently"}</p>
                    </div>
                    {suggestion.masjidSnapshot && !masjid && (
                      <div className="notice compact neutral">
                        Discovery snapshot: {suggestion.masjidSnapshot.address}. This is not in Firestore yet.
                      </div>
                    )}
                    <p><strong>Suggested:</strong> {suggestion.suggestedValue}</p>
                    {suggestion.notes && <p><strong>Notes:</strong> {suggestion.notes}</p>}
                    {suggestion.field === "jamaat" && (
                      <p className="small-text">Tip: jamaat suggestions apply best when the value includes salah + time, like “Asr 17:20”.</p>
                    )}
                    <div className="cta-row">
                      {suggestion.masjidSnapshot && !masjid ? (
                        <button className="secondary-button" type="button" onClick={() => handleCreateListingFromSuggestion(suggestion)} disabled={isSaving}>
                          Create listing
                        </button>
                      ) : !masjid ? (
                        <button className="secondary-button" type="button" onClick={() => handleMarkSuggestionReviewed(suggestion.id)} disabled={isSaving}>
                          Mark reviewed
                        </button>
                      ) : (
                        <button className="secondary-button" type="button" onClick={() => handleApproveSuggestion(suggestion)} disabled={isSaving}>
                          Apply
                        </button>
                      )}
                      <button className="ghost-button" type="button" onClick={() => handleRejectSuggestion(suggestion.id)} disabled={isSaving}>
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}

        <Link className="ghost-button full" href="/">Back home</Link>
        <div className="footer-space" />
      </main>
    </>
  );
}
