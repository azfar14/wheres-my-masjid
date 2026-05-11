"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { AppHeader } from "@/components/AppHeader";
import { getFirebaseAuth } from "@/lib/firebase";
import { previewMasjidImport, type PipelinePreview } from "@/lib/dataPipeline";
import { upsertMasjids } from "@/lib/masjidService";

const exampleJson = JSON.stringify([
  {
    id: "masjid-thaqwa-ambattur",
    name: "Masjid Thaqwa",
    locality: "Ambattur, Chennai",
    address: "Paste exact address here",
    lat: 13.1143,
    lng: 80.1548,
    verificationStatus: "community_checked",
    navigationVerified: false,
    jumuah: ["13:15"],
    jamaat: { fajr: "05:10", dhuhr: "13:30", asr: "17:15", maghrib: "18:45", isha: "20:15" }
  }
], null, 2);

export default function AdminDataPipelinePage() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jsonText, setJsonText] = useState(exampleJson);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const preview: PipelinePreview = useMemo(() => previewMasjidImport(jsonText), [jsonText]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return unsub;
  }, []);

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
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
    }
  }

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }

  async function handleImport() {
    if (!preview.valid.length) {
      setError("No valid masjids to import.");
      return;
    }
    if (preview.stats.errors > 0) {
      setError("Fix import errors before committing.");
      return;
    }
    setIsSaving(true);
    setStatus(undefined);
    setError(undefined);
    try {
      const count = await upsertMasjids(preview.valid, user?.uid);
      setStatus(`Imported/updated ${count} masjid listing${count === 1 ? "" : "s"}. Verify exact pins before unlocking direct navigation.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import masjids.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!authReady) return <><AppHeader /><main><section className="hero-card"><h2 className="hero-title">Loading data pipeline…</h2></section></main></>;

  if (!user) {
    return (
      <>
        <AppHeader />
        <main>
          <section className="hero-card"><p className="kicker">Data pipeline</p><h2 className="hero-title">Sign in to import, validate, and stage masjid data.</h2></section>
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
        <section className="hero-card admin-pipeline-hero">
          <p className="kicker">Data pipeline</p>
          <h2 className="hero-title">Import, validate, and stage masjid records without slowing down the public app.</h2>
          <p className="hero-copy">This page is admin-only and lazy-loaded. It does not run during normal user nearby search.</p>
          <div className="hero-meta">
            <span className="pill">{user.email ?? user.uid}</span>
            <Link className="header-chip" href="/admin/analytics">Analytics</Link>
            <button className="ghost-button" type="button" onClick={() => void handleLogout()}>Sign out</button>
          </div>
        </section>

        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        <section className="stats-grid analytics-stats">
          <div className="stat-card"><span>Input rows</span><strong>{preview.stats.totalInput}</strong></div>
          <div className="stat-card"><span>Valid</span><strong>{preview.stats.valid}</strong></div>
          <div className="stat-card"><span>Errors</span><strong>{preview.stats.errors}</strong></div>
          <div className="stat-card"><span>Warnings</span><strong>{preview.stats.warnings}</strong></div>
          <div className="stat-card"><span>With Jumu’ah</span><strong>{preview.stats.withJumuah}</strong></div>
          <div className="stat-card"><span>Nav-ready</span><strong>{preview.stats.navigationReady}</strong></div>
        </section>

        <section className="dashboard-grid pipeline-grid">
          <form className="form-card" onSubmit={(event) => { event.preventDefault(); void handleImport(); }}>
            <h3>Bulk import JSON</h3>
            <p className="small-text">Paste an array of masjid records. Exact coordinates are required. Imported records stay non-direct-route until verified unless you explicitly set navigationVerified true.</p>
            <textarea className="pipeline-json-box" value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
            <button className="button full" type="submit" disabled={isSaving || preview.stats.errors > 0 || preview.valid.length === 0}>{isSaving ? "Importing…" : "Commit valid records"}</button>
          </form>

          <section className="form-card">
            <h3>Validation issues</h3>
            {preview.issues.length ? (
              <div className="pipeline-issue-list">
                {preview.issues.slice(0, 80).map((issue, index) => (
                  <div className={issue.severity === "error" ? "notice danger compact" : "notice neutral compact"} key={`${issue.index}-${index}`}>
                    <strong>{issue.severity.toUpperCase()} row {issue.index + 1}</strong><br />{issue.message}
                  </div>
                ))}
              </div>
            ) : <div className="notice success compact">No issues found. Records are ready to stage.</div>}
          </section>
        </section>
      </main>
    </>
  );
}
