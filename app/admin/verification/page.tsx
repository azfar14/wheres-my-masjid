"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { AppHeader } from "@/components/AppHeader";
import { useMasjids } from "@/hooks/useMasjids";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import {
  approveClaimAndAssignAdmin,
  createDefaultVerificationChecklist,
  deleteDemoMasjids,
  listAdminProfiles,
  listClaimRequests,
  updateClaimRequestStatus,
  upsertAdminProfile,
  verifyMasjidListing
} from "@/lib/masjidService";
import { formatDistance } from "@/lib/geo";
import type { AdminProfile, AdminRole, ClaimRequest, Masjid, MasjidVerificationChecklist, VerificationStatus } from "@/types";

const checklistLabels: Array<{ key: keyof MasjidVerificationChecklist; label: string; helper: string }> = [
  { key: "nameChecked", label: "Name checked", helper: "Name matches notice board / Google Maps / local masjid usage." },
  { key: "addressChecked", label: "Address checked", helper: "Address/locality is readable and not a random street/place name." },
  { key: "pinChecked", label: "Exact pin checked", helper: "Latitude/longitude points to the actual masjid entrance/building." },
  { key: "routeTested", label: "Google route tested", helper: "Start nav was opened and the destination looked correct in Google Maps." },
  { key: "timingsChecked", label: "Jamaat timings checked", helper: "Today’s jamaat/Jumu’ah timings were confirmed from a trusted source." },
  { key: "contactChecked", label: "Contact/proof checked", helper: "Committee contact, phone, photo, or local proof was reviewed." }
];

function splitIds(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function verificationComplete(checklist: MasjidVerificationChecklist): boolean {
  return checklist.nameChecked && checklist.addressChecked && checklist.pinChecked && checklist.routeTested && checklist.timingsChecked;
}

function directGoogleTestUrl(masjid?: Masjid): string {
  if (!masjid) return "https://www.google.com/maps";
  const destination = `${masjid.coordinates.lat.toFixed(6)},${masjid.coordinates.lng.toFixed(6)}`;
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "walking",
    dir_action: "navigate"
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function googleSearchUrl(masjid?: Masjid): string {
  const query = masjid ? `${masjid.name} ${masjid.locality} mosque` : "mosque";
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query }).toString()}`;
}

function scoreMasjidVerification(masjid: Masjid): number {
  let score = 0;
  if (masjid.verificationStatus === "admin_verified") score += 30;
  if (masjid.verificationStatus === "community_checked") score += 20;
  if (masjid.navigationVerified) score += 30;
  if (masjid.jumuah.length) score += 10;
  if (masjid.phone) score += 5;
  if (masjid.assignedAdminIds?.length) score += 10;
  if (masjid.verificationChecklist) {
    score += Object.values(masjid.verificationChecklist).filter(Boolean).length * 2;
  }
  return Math.min(100, score);
}

function isDemoListing(masjid: Masjid): boolean {
  const text = `${masjid.id} ${masjid.name} ${masjid.locality} ${masjid.address}`.toLowerCase();
  return (
    masjid.id.startsWith("demo-") ||
    masjid.source === "demo" ||
    text.includes("demo") ||
    text.includes("sample city")
  );
}

function needVerification(masjid: Masjid): boolean {
  return !isDemoListing(masjid) && (masjid.verificationStatus !== "admin_verified" || masjid.navigationVerified !== true);
}

export default function MasjidVerificationDashboardPage() {
  useEffect(() => {
    document.body.classList.add("admin-wide-mode");
    return () => document.body.classList.remove("admin-wide-mode");
  }, []);

  const { masjids, isLoading, refresh } = useMasjids({ includeLegacyDemoRecords: true });
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [selectedMasjidId, setSelectedMasjidId] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("admin_verified");
  const [checklist, setChecklist] = useState<MasjidVerificationChecklist>(() => createDefaultVerificationChecklist());
  const [verificationNotes, setVerificationNotes] = useState("");
  const [assignedAdminIdsText, setAssignedAdminIdsText] = useState("");
  const [claimAssignments, setClaimAssignments] = useState<Record<string, { uid: string; email: string; notes: string }>>({});
  const [manualAdmin, setManualAdmin] = useState<{ uid: string; email: string; role: AdminRole; masjidIds: string }>({
    uid: "",
    email: "",
    role: "masjid_admin",
    masjidIds: ""
  });

  const demoMasjids = useMemo(() => masjids.filter(isDemoListing), [masjids]);
  const realMasjids = useMemo(() => masjids.filter((masjid) => !isDemoListing(masjid)), [masjids]);
  const selectedMasjid = useMemo(() => realMasjids.find((masjid) => masjid.id === selectedMasjidId), [realMasjids, selectedMasjidId]);
  const pendingClaims = useMemo(() => claims.filter((claim) => claim.status === "pending"), [claims]);
  const verifiedMasjids = useMemo(() => realMasjids.filter((masjid) => masjid.verificationStatus === "admin_verified"), [realMasjids]);
  const navigationReadyMasjids = useMemo(() => realMasjids.filter((masjid) => masjid.navigationVerified === true), [realMasjids]);
  const queueMasjids = useMemo(
    () => realMasjids.filter(needVerification).sort((a, b) => scoreMasjidVerification(a) - scoreMasjidVerification(b)),
    [realMasjids]
  );

  const loadAdminData = useCallback(async () => {
    if (!user || !isFirebaseConfigured) return;
    setError(undefined);
    try {
      const [nextClaims, nextAdmins] = await Promise.all([listClaimRequests("all"), listAdminProfiles()]);
      setClaims(nextClaims);
      setAdmins(nextAdmins);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load verification dashboard data.");
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
    if (!selectedMasjidId && queueMasjids.length) {
      setSelectedMasjidId(queueMasjids[0].id);
    } else if (!selectedMasjidId && realMasjids.length) {
      setSelectedMasjidId(realMasjids[0].id);
    } else if (selectedMasjidId && !realMasjids.some((masjid) => masjid.id === selectedMasjidId)) {
      setSelectedMasjidId(queueMasjids[0]?.id ?? realMasjids[0]?.id ?? "");
    }
  }, [realMasjids, queueMasjids, selectedMasjidId]);

  useEffect(() => {
    if (!selectedMasjid) return;
    setVerificationStatus(selectedMasjid.verificationStatus === "community_checked" ? "community_checked" : "admin_verified");
    setChecklist(selectedMasjid.verificationChecklist ?? createDefaultVerificationChecklist());
    setVerificationNotes(selectedMasjid.verificationNotes ?? "");
    setAssignedAdminIdsText((selectedMasjid.assignedAdminIds ?? []).join(", "));
  }, [selectedMasjid]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase Auth is not configured.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus("Logged in.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
    }
  }

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }

  async function handleRemoveDemoListings() {
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      const count = await deleteDemoMasjids();
      await refresh();
      setStatus(`Removed ${count} demo listing${count === 1 ? "" : "s"}. Verification queue now shows real listings only.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove demo listings. Check admin permissions and Firestore rules.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMasjid) {
      setError("Select a masjid first.");
      return;
    }
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      await verifyMasjidListing({
        masjidId: selectedMasjid.id,
        status: verificationStatus,
        checklist,
        notes: verificationNotes,
        verifiedBy: user?.uid,
        assignedAdminIds: splitIds(assignedAdminIdsText)
      });
      await refresh();
      setStatus(verificationComplete(checklist)
        ? "Masjid verified. Direct Google navigation is now unlocked for this listing."
        : "Verification saved. Direct navigation stays locked until the checklist is complete.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save verification.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateClaimAssignment(claimId: string, field: "uid" | "email" | "notes", value: string) {
    setClaimAssignments((current) => ({
      ...current,
      [claimId]: {
        uid: current[claimId]?.uid ?? "",
        email: current[claimId]?.email ?? "",
        notes: current[claimId]?.notes ?? "",
        [field]: value
      }
    }));
  }

  async function handleApproveClaim(claim: ClaimRequest) {
    const assignment = claimAssignments[claim.id];
    if (!assignment?.uid.trim()) {
      setError("Paste the claimant’s Firebase Auth UID before approving. Create their Auth user first if needed.");
      return;
    }
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      await approveClaimAndAssignAdmin({
        claimId: claim.id,
        masjidId: claim.masjidId,
        adminUid: assignment.uid.trim(),
        adminEmail: assignment.email.trim() || claim.requesterEmail,
        notes: assignment.notes.trim() || undefined,
        reviewedBy: user?.uid
      });
      await Promise.all([refresh(), loadAdminData()]);
      setStatus(`Claim approved and ${assignment.uid.trim()} assigned to ${claim.masjidName}.`);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not approve claim.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRejectClaim(claim: ClaimRequest) {
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      await updateClaimRequestStatus(claim.id, "rejected", user?.uid);
      await loadAdminData();
      setStatus("Claim rejected.");
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not reject claim.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleManualAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      await upsertAdminProfile(
        {
          id: manualAdmin.uid.trim(),
          email: manualAdmin.email.trim() || undefined,
          role: manualAdmin.role,
          masjidIds: splitIds(manualAdmin.masjidIds)
        },
        user?.uid
      );
      await loadAdminData();
      setStatus("Admin profile saved.");
      setManualAdmin({ uid: "", email: "", role: "masjid_admin", masjidIds: "" });
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : "Could not save admin profile.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!authReady) {
    return (
      <>
        <AppHeader />
        <main><section className="hero-card"><h2 className="hero-title">Loading verification dashboard…</h2></section></main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AppHeader />
        <main>
          <section className="hero-card">
            <p className="kicker">Verification control room</p>
            <h2 className="hero-title">Masjid Verification + Claim Dashboard</h2>
            <p className="hero-copy">Sign in as an admin to verify exact pins, unlock safe navigation, and assign masjid committee admins.</p>
          </section>
          {error && <div className="notice danger compact">{error}</div>}
          <form className="info-card form-stack" onSubmit={handleLogin}>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button className="button" type="submit">Sign in</button>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card verification-hero">
          <p className="kicker">Trust operations</p>
          <h2 className="hero-title">Masjid Verification + Claim Dashboard</h2>
          <p className="hero-copy">Verify exact pins before direct navigation, approve committee claims, and build the trusted masjid network.</p>
          <div className="hero-meta">
            <span className="pill">{user.email ?? user.uid}</span>
            <Link className="header-chip" href="/admin">Admin home</Link>
            <button className="ghost-button" type="button" onClick={handleLogout}>Sign out</button>
          </div>
        </section>

        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        {demoMasjids.length > 0 && (
          <section className="notice danger compact demo-cleanup-banner">
            <strong>{demoMasjids.length} demo listing{demoMasjids.length === 1 ? "" : "s"} hidden from verification.</strong>
            <span> They are not shown in the queue anymore. Remove them from Firestore so the admin area stays clean.</span>
            <button className="ghost-button" type="button" onClick={() => void handleRemoveDemoListings()} disabled={isSaving}>
              {isSaving ? "Removing…" : "Remove demo listings"}
            </button>
          </section>
        )}

        <section className="stats-grid verification-stats">
          <div className="stat-card"><span>Real listings</span><strong>{isLoading ? "…" : realMasjids.length}</strong></div>
          <div className="stat-card"><span>Admin verified</span><strong>{verifiedMasjids.length}</strong></div>
          <div className="stat-card"><span>Navigation-ready</span><strong>{navigationReadyMasjids.length}</strong></div>
          <div className="stat-card"><span>Pending claims</span><strong>{pendingClaims.length}</strong></div>
        </section>

        <section className="info-card launch-gate-card">
          <h3>Navigation launch rule</h3>
          <p className="small-text">Direct turn-by-turn navigation is unlocked only when the masjid is admin/community verified and the route test checklist is complete. External Foursquare/Mappls/OSM pins stay in “Check in Google Maps” mode until verified.</p>
        </section>

        {realMasjids.length === 0 ? (
          <section className="verification-empty-layout">
            <div className="form-card verification-empty-card">
              <p className="kicker dark">No real listings yet</p>
              <h3>Nothing needs verification right now</h3>
              <p className="small-text">Demo records are hidden from the trust queue. Discover nearby masjids, import a city dataset, or add verified listings before using the verification checklist.</p>
              <div className="verification-empty-actions">
                <Link className="button" href="/nearby">Discover nearby masjids</Link>
                <Link className="secondary-button" href="/admin">Add verified masjid</Link>
                <Link className="ghost-button" href="/admin/data-pipeline">Bulk import</Link>
              </div>
            </div>
            <section className="form-card verification-queue-panel">
              <div className="section-inline-head">
                <div>
                  <h3>Verification queue</h3>
                  <p className="small-text">Only real masjids appear here. Demo listings stay hidden.</p>
                </div>
                <span className="pill">0 open</span>
              </div>
              <div className="notice neutral compact">No real listing needs verification right now. Use /nearby, /missing, /admin, or /admin/data-pipeline to create real listings.</div>
            </section>
          </section>
        ) : (
        <section className="dashboard-grid verification-dashboard-grid">
          <form className="form-card verification-form-panel" onSubmit={handleSaveVerification}>
            <div className="section-inline-head">
              <div>
                <h3>Verify a masjid listing</h3>
                <p className="small-text">Use this to turn discovered listings into trusted, route-tested masjids.</p>
              </div>
              <button className="ghost-button" type="button" onClick={refresh}>Refresh</button>
            </div>

            <label>
              Select masjid
              <select value={selectedMasjidId} onChange={(event) => setSelectedMasjidId(event.target.value)}>
                {realMasjids.map((masjid) => (
                  <option key={masjid.id} value={masjid.id}>{masjid.name} · {masjid.locality}</option>
                ))}
              </select>
            </label>

            {realMasjids.length === 0 && (
              <div className="notice neutral compact">No real masjid listings are ready for verification yet. Use /nearby to discover listings, submit a missing masjid, or add a verified masjid from /admin.</div>
            )}

            {selectedMasjid && (
              <div className="notice compact neutral">
                <strong>{selectedMasjid.name}</strong><br />
                {selectedMasjid.address}<br />
                Pin: {selectedMasjid.coordinates.lat.toFixed(6)}, {selectedMasjid.coordinates.lng.toFixed(6)} · Score {scoreMasjidVerification(selectedMasjid)}/100
              </div>
            )}

            <div className="cta-row compact-card-actions">
              <a className="secondary-button" href={directGoogleTestUrl(selectedMasjid)} target="_blank" rel="noreferrer">Test direct route</a>
              <a className="ghost-button" href={googleSearchUrl(selectedMasjid)} target="_blank" rel="noreferrer">Find in Google Maps</a>
            </div>

            <label>
              Verification status
              <select value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value as VerificationStatus)}>
                <option value="admin_verified">Admin verified</option>
                <option value="community_checked">Community checked</option>
                <option value="demo_unverified">Needs verification</option>
              </select>
            </label>

            <div className="verification-checklist">
              {checklistLabels.map((item) => (
                <label className="checkbox-card" key={item.key}>
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    onChange={(event) => setChecklist((current) => ({ ...current, [item.key]: event.target.checked }))}
                  />
                  <span><strong>{item.label}</strong><small>{item.helper}</small></span>
                </label>
              ))}
            </div>

            <label>
              Assigned admin UIDs
              <textarea value={assignedAdminIdsText} onChange={(event) => setAssignedAdminIdsText(event.target.value)} placeholder="Firebase Auth UIDs, comma-separated" />
            </label>

            <label>
              Verification notes
              <textarea value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} placeholder="Example: Route tested in Google Maps on phone; pin lands at masjid gate; timings checked from notice board." />
            </label>

            <button className="button full" type="submit" disabled={isSaving || !selectedMasjid}>
              {isSaving ? "Saving…" : verificationComplete(checklist) ? "Save and unlock direct nav" : "Save verification draft"}
            </button>
          </form>

          <section className="form-card verification-queue-panel">
            <div className="section-inline-head">
              <div>
                <h3>Verification queue</h3>
                <p className="small-text">Lowest-trust listings first. Verify these before public launch.</p>
              </div>
              <span className="pill">{queueMasjids.length} open</span>
            </div>
            <div className="queue-list">
              {queueMasjids.slice(0, 20).map((masjid) => (
                <button className="queue-item" type="button" key={masjid.id} onClick={() => setSelectedMasjidId(masjid.id)}>
                  <span><strong>{masjid.name}</strong><small>{masjid.locality} · {masjid.verificationStatus}</small></span>
                  <em>{scoreMasjidVerification(masjid)}/100</em>
                </button>
              ))}
              {queueMasjids.length === 0 && <div className="notice neutral compact">No real listing needs verification right now. Demo listings are hidden; add or discover real masjids to verify them.</div>}
            </div>
          </section>
        </section>
        )}

        <section className="info-card">
          <div className="section-inline-head">
            <div>
              <h3>Claim requests</h3>
              <p className="small-text">Approve only after confirming identity. Create the Firebase Auth user first, then paste their UID.</p>
            </div>
            <button className="ghost-button" type="button" onClick={loadAdminData}>Refresh claims</button>
          </div>

          {pendingClaims.length === 0 && <div className="notice neutral compact">No pending claims.</div>}
          <div className="claim-grid">
            {pendingClaims.map((claim) => {
              const assignment = claimAssignments[claim.id] ?? { uid: "", email: claim.requesterEmail ?? "", notes: "" };
              return (
                <article className="claim-review-card" key={claim.id}>
                  <div className="section-inline-head">
                    <div>
                      <h4>{claim.masjidName || claim.masjidId}</h4>
                      <p className="small-text">{claim.role} · {claim.createdAt ?? "recently"}</p>
                    </div>
                    <Link className="header-chip" href={`/masjid/${claim.masjidId}`}>Listing</Link>
                  </div>
                  <p><strong>Requester:</strong> {claim.requesterName} · {claim.requesterPhone}{claim.requesterEmail ? ` · ${claim.requesterEmail}` : ""}</p>
                  <p><strong>Proof:</strong> {claim.proof}</p>
                  {claim.notes && <p><strong>Notes:</strong> {claim.notes}</p>}
                  <label>
                    Firebase Auth UID to assign
                    <input value={assignment.uid} onChange={(event) => updateClaimAssignment(claim.id, "uid", event.target.value)} placeholder="Paste UID from Firebase Authentication → Users" />
                  </label>
                  <label>
                    Admin email
                    <input type="email" value={assignment.email} onChange={(event) => updateClaimAssignment(claim.id, "email", event.target.value)} placeholder="committee@example.com" />
                  </label>
                  <label>
                    Review notes
                    <textarea value={assignment.notes} onChange={(event) => updateClaimAssignment(claim.id, "notes", event.target.value)} placeholder="Identity confirmed by phone call / masjid office / local proof." />
                  </label>
                  <div className="cta-row">
                    <button className="secondary-button" type="button" onClick={() => handleApproveClaim(claim)} disabled={isSaving}>Approve + assign</button>
                    <button className="ghost-button" type="button" onClick={() => handleRejectClaim(claim)} disabled={isSaving}>Reject</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dashboard-grid verification-dashboard-grid">
          <form className="form-card" onSubmit={handleManualAdmin}>
            <h3>Manual admin assignment</h3>
            <p className="small-text">Use this when a committee member already has a Firebase Auth account.</p>
            <label>Firebase Auth UID<input value={manualAdmin.uid} onChange={(event) => setManualAdmin((current) => ({ ...current, uid: event.target.value }))} required /></label>
            <label>Email<input type="email" value={manualAdmin.email} onChange={(event) => setManualAdmin((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>
              Role
              <select value={manualAdmin.role} onChange={(event) => setManualAdmin((current) => ({ ...current, role: event.target.value as AdminRole }))}>
                <option value="masjid_admin">Masjid admin</option>
                <option value="reviewer">Reviewer</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <label>Masjid IDs<textarea value={manualAdmin.masjidIds} onChange={(event) => setManualAdmin((current) => ({ ...current, masjidIds: event.target.value }))} placeholder="masjid-thaqwa, masjid-e-zainab" /></label>
            <button className="button full" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save admin profile"}</button>
          </form>

          <section className="form-card">
            <h3>Current admin profiles</h3>
            {admins.length === 0 && <div className="notice neutral compact">No admin profiles found yet.</div>}
            <div className="queue-list">
              {admins.map((admin) => (
                <div className="queue-item static" key={admin.id}>
                  <span><strong>{admin.email ?? admin.id}</strong><small>{admin.role} · {(admin.masjidIds ?? []).join(", ") || "all / not assigned"}</small></span>
                  <em>{admin.masjidIds?.length ?? 0}</em>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="info-card launch-gate-card">
          <h3>Before launch</h3>
          <ul className="check-list">
            <li>Verify at least 10–20 local masjids with route-tested pins.</li>
            <li>Only route-tested listings will show direct “Start nav”.</li>
            <li>All Foursquare/Mappls/OSM discoveries remain “Check in Google Maps” until verified.</li>
            <li>Use the claim dashboard to assign each committee to only its own masjid.</li>
          </ul>
        </section>
        <div className="footer-space" />
      </main>
    </>
  );
}
