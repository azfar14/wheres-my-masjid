"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { getFirebaseAuth } from "@/lib/firebase";
import { createMasjidAnnouncement, listMasjidsForAdmin, updateManagedMasjidProfile } from "@/lib/masjidService";
import { salahDisplayNames, salahOrder } from "@/lib/jamaat";
import { displayMasjidLocality, displayMasjidName } from "@/lib/masjidDisplay";
import type { AdminProfile, Masjid, MasjidAnnouncementPriority, SalahKey } from "@/types";

function splitLooseList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function blankTimes(): Record<SalahKey, string> {
  return { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" };
}

export default function MyMasjidsPage() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<AdminProfile | undefined>();
  const [masjids, setMasjids] = useState<Masjid[]>([]);
  const [source, setSource] = useState<"firebase" | "demo" | "empty" | "error" | "local_discovery">("empty");
  const [sourceMessage, setSourceMessage] = useState<string | undefined>();
  const [selectedMasjidId, setSelectedMasjidId] = useState("");
  const [jamaat, setJamaat] = useState<Record<SalahKey, string>>(blankTimes());
  const [jumuahText, setJumuahText] = useState("");
  const [phone, setPhone] = useState("");
  const [facilitiesText, setFacilitiesText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [notes, setNotes] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementPriority, setAnnouncementPriority] = useState<MasjidAnnouncementPriority>("normal");
  const [announcementExpiresAt, setAnnouncementExpiresAt] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase is not configured yet. Add .env.local values before using the masjid dashboard.");
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) void loadDashboard(nextUser.uid);
      else {
        setProfile(undefined);
        setMasjids([]);
        setSelectedMasjidId("");
      }
    });
  }, []);

  const selectedMasjid = useMemo(
    () => masjids.find((masjid) => masjid.id === selectedMasjidId),
    [masjids, selectedMasjidId]
  );

  useEffect(() => {
    if (!selectedMasjid) return;
    setJamaat(selectedMasjid.jamaat);
    setJumuahText(selectedMasjid.jumuah.join(", "));
    setPhone(selectedMasjid.phone ?? "");
    setFacilitiesText(selectedMasjid.facilities.join(", "));
    setLanguagesText(selectedMasjid.khutbahLanguages.join(", "));
    setNotes(selectedMasjid.notes ?? "");
  }, [selectedMasjid]);

  async function loadDashboard(uid = user?.uid) {
    if (!uid) return;
    setIsLoadingData(true);
    setError(undefined);
    try {
      const result = await listMasjidsForAdmin(uid);
      setProfile(result.profile);
      setMasjids(result.masjids);
      setSource(result.source);
      setSourceMessage(result.message);
      setSelectedMasjidId((current) => {
        if (current && result.masjids.some((masjid) => masjid.id === current)) return current;
        return result.masjids[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load assigned masjids.");
      setSource("error");
    } finally {
      setIsLoadingData(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const auth = getFirebaseAuth();
    if (!auth) {
      setError("Firebase is not configured yet.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
    }
  }

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selectedMasjid) return;
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      await updateManagedMasjidProfile({
        masjidId: selectedMasjid.id,
        adminUid: user.uid,
        jamaat,
        jumuah: splitLooseList(jumuahText),
        phone,
        facilities: splitLooseList(facilitiesText),
        khutbahLanguages: splitLooseList(languagesText),
        notes
      });
      await loadDashboard(user.uid);
      setStatus("Saved. This masjid is now updated from the approved masjid dashboard.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save masjid update.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selectedMasjid) return;
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      await createMasjidAnnouncement(
        {
          masjidId: selectedMasjid.id,
          title: announcementTitle,
          message: announcementMessage,
          priority: announcementPriority,
          expiresAt: announcementExpiresAt || undefined
        },
        user.uid
      );
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementPriority("normal");
      setAnnouncementExpiresAt("");
      setStatus("Announcement published on the public masjid profile.");
    } catch (announcementError) {
      setError(announcementError instanceof Error ? announcementError.message : "Could not publish announcement.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="my-masjids-page safe-layout-page">
        <section className="hero-card claim-hero masjid-os-hero">
          <p className="kicker">Masjid operations dashboard</p>
          <h2 className="hero-title">Approved masjid teams can keep their own timings fresh.</h2>
          <p className="small-text">This is the safe productivity layer: no public user gets edit access, and every approved masjid admin is limited to assigned masjid listings.</p>
          <div className="cta-row premium-cta-row">
            <Link className="secondary-button" href="/claim">Request access</Link>
            <Link className="ghost-button" href="/network">Network plan</Link>
          </div>
        </section>

        {!authReady && <div className="notice neutral compact">Checking sign-in…</div>}
        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        {!user && authReady ? (
          <form className="info-card form-stack" onSubmit={handleLogin}>
            <h3>Sign in as an approved masjid admin</h3>
            <p className="small-text">Use the Firebase Auth account that the platform owner/admin approved after the claim procedure.</p>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button className="button full" type="submit">Sign in</button>
          </form>
        ) : null}

        {user && (
          <>
            <section className="info-card network-health-card">
              <div className="section-inline-head network-health-head">
                <div>
                  <h3>{profile ? "Approved access" : "Access pending"}</h3>
                  <p className="small-text">Signed in as {user.email ?? user.uid}</p>
                </div>
                <button className="ghost-button" type="button" onClick={handleLogout}>Sign out</button>
              </div>
              <div className="meta-grid network-stat-grid">
                <div className="meta-item"><span>Role</span><strong>{profile?.role ?? "not approved"}</strong></div>
                <div className="meta-item"><span>Assigned</span><strong>{masjids.length}</strong></div>
                <div className="meta-item"><span>Status</span><strong>{profile ? "Active" : "Claim needed"}</strong></div>
                <div className="meta-item"><span>Mode</span><strong>Masjid-only</strong></div>
              </div>
            </section>

            <DataStatus source={source} message={sourceMessage} isLoading={isLoadingData} />

            {!profile && (
              <section className="info-card empty-state">
                <h2>No approved masjid profile yet</h2>
                <p>Submit a claim and wait for the owner/admin to verify your identity, create/confirm your Firebase Auth user, and assign the masjid to this account.</p>
                <div className="card-actions">
                  <Link className="button" href="/claim">Start claim</Link>
                  <Link className="ghost-button" href="/nearby">Find listing</Link>
                </div>
              </section>
            )}

            {profile && masjids.length === 0 && (
              <section className="info-card empty-state">
                <h2>No masjids assigned</h2>
                <p>Your admin profile exists, but no masjid ID is assigned yet. Ask the platform owner to assign the correct masjid listing from the verification dashboard.</p>
              </section>
            )}

            {profile && masjids.length > 0 && (
              <>
              <section className="dashboard-grid masjid-os-grid">
                <section className="form-card verification-queue-panel">
                  <div className="section-inline-head">
                    <div>
                      <h3>Assigned masjids</h3>
                      <p className="small-text">Choose the listing you are authorised to maintain.</p>
                    </div>
                    <button className="ghost-button" type="button" onClick={() => void loadDashboard(user.uid)}>Refresh</button>
                  </div>
                  <div className="queue-list">
                    {masjids.map((masjid) => (
                      <button className="queue-item" type="button" key={masjid.id} onClick={() => setSelectedMasjidId(masjid.id)}>
                        <span><strong>{displayMasjidName(masjid)}</strong><small>{displayMasjidLocality(masjid)} · {masjid.lastVerifiedAt}</small></span>
                        <em>{masjid.jumuah.length ? "Ready" : "Needs Jumu’ah"}</em>
                      </button>
                    ))}
                  </div>
                </section>

                <form className="form-card verification-form-panel" onSubmit={handleSave}>
                  <div className="section-inline-head">
                    <div>
                      <h3>Update timings and public info</h3>
                      <p className="small-text">These fields are safe for approved masjid teams and do not expose the internal admin control room.</p>
                    </div>
                    {selectedMasjid && <Link className="header-chip" href={`/masjid/${selectedMasjid.id}`}>Public page</Link>}
                  </div>

                  <label>
                    Select masjid
                    <select value={selectedMasjidId} onChange={(event) => setSelectedMasjidId(event.target.value)}>
                      {masjids.map((masjid) => (
                        <option key={masjid.id} value={masjid.id}>{displayMasjidName(masjid)} · {displayMasjidLocality(masjid)}</option>
                      ))}
                    </select>
                  </label>

                  <div className="field-grid">
                    {salahOrder.map((salah) => (
                      <label key={salah}>
                        {salahDisplayNames[salah]}
                        <input
                          value={jamaat[salah]}
                          onChange={(event) => setJamaat((current) => ({ ...current, [salah]: event.target.value }))}
                          placeholder="05:10"
                          pattern="[0-9]{2}:[0-9]{2}"
                          required
                        />
                      </label>
                    ))}
                  </div>

                  <label>Jumu’ah times<input value={jumuahText} onChange={(event) => setJumuahText(event.target.value)} placeholder="13:15, 14:00" /></label>
                  <label>Official phone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Masjid office / WhatsApp" /></label>
                  <label>Facilities<input value={facilitiesText} onChange={(event) => setFacilitiesText(event.target.value)} placeholder="Wudu, Parking, Women’s space" /></label>
                  <label>Khutbah languages<input value={languagesText} onChange={(event) => setLanguagesText(event.target.value)} placeholder="Tamil, Urdu, English" /></label>
                  <label>Public profile note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: office hours, renovation note, parking note, or general public information." /></label>

                  <div className="notice compact neutral">Only approved accounts can save. Updates are written to the masjid listing and the daily jamaat timing history.</div>
                  <button className="button full" type="submit" disabled={isSaving || !selectedMasjid}>
                    {isSaving ? "Saving…" : "Save masjid update"}
                  </button>
                </form>
              </section>

              <form className="info-card form-stack announcement-publisher" onSubmit={handlePublishAnnouncement}>
                <h3>Publish masjid announcement</h3>
                <p className="small-text">Use this for Ramadan updates, Jumu’ah notices, temporary closures, Eid info, or urgent timing changes. It appears on the public masjid profile.</p>
                <label>Title<input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Example: Ramadan timetable updated" required /></label>
                <label>Message<textarea value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} placeholder="Write a clear short update for users." required /></label>
                <div className="field-grid">
                  <label>
                    Priority
                    <select value={announcementPriority} onChange={(event) => setAnnouncementPriority(event.target.value as MasjidAnnouncementPriority)}>
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <label>Expires after, optional<input type="date" value={announcementExpiresAt} onChange={(event) => setAnnouncementExpiresAt(event.target.value)} /></label>
                </div>
                <button className="secondary-button full" type="submit" disabled={isSaving || !selectedMasjid}>{isSaving ? "Publishing…" : "Publish announcement"}</button>
              </form>
              </>
            )}
          </>
        )}

        <section className="info-card claim-security-card">
          <h3>Why this does not mess with the public app</h3>
          <div className="claim-process-grid">
            <article className="claim-step-card"><span>1</span><strong>Separate dashboard</strong><p>Normal users keep using Nearby, Qibla, Saved, Missing, and Claim as before.</p></article>
            <article className="claim-step-card"><span>2</span><strong>Approved accounts only</strong><p>The dashboard requires Firebase Auth and an admin profile created after claim review.</p></article>
            <article className="claim-step-card"><span>3</span><strong>Masjid-only scope</strong><p>Committee users can update only masjids assigned to their UID.</p></article>
            <article className="claim-step-card"><span>4</span><strong>Audit-friendly</strong><p>Timing/profile updates write to masjid data, timing history, and public announcement records.</p></article>
          </div>
        </section>

        <div className="footer-space" />
      </main>
    </>
  );
}
