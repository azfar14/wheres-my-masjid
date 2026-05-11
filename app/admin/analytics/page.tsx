"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { AppHeader } from "@/components/AppHeader";
import { getFirebaseAuth } from "@/lib/firebase";
import { useMasjids } from "@/hooks/useMasjids";
import { chennaiPipelineSnapshot, computeCoverageStats } from "@/lib/analyticsEngine";

export default function AdminAnalyticsPage() {
  const { masjids, isLoading, refresh } = useMasjids({ includeLegacyDemoRecords: true });
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const stats = useMemo(() => computeCoverageStats(masjids.filter((item) => !item.id.startsWith("demo-") && !item.name.toLowerCase().includes("demo"))), [masjids]);

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

  if (!authReady) {
    return <><AppHeader /><main><section className="hero-card"><h2 className="hero-title">Loading analytics…</h2></section></main></>;
  }

  if (!user) {
    return (
      <>
        <AppHeader />
        <main>
          <section className="hero-card">
            <p className="kicker">Admin analytics</p>
            <h2 className="hero-title">Sign in to view coverage, verification, and launch readiness.</h2>
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
        <section className="hero-card admin-analytics-hero">
          <p className="kicker">Analytics engine</p>
          <h2 className="hero-title">Coverage, verification, navigation readiness, and pipeline health.</h2>
          <p className="hero-copy">These admin-only analytics are calculated after the page loads, so they do not slow down public nearby search.</p>
          <div className="hero-meta">
            <span className="pill">{user.email ?? user.uid}</span>
            <button className="ghost-button" type="button" onClick={() => void refresh()}>{isLoading ? "Refreshing…" : "Refresh"}</button>
            <button className="ghost-button" type="button" onClick={() => void handleLogout()}>Sign out</button>
          </div>
        </section>

        <section className="stats-grid analytics-stats">
          <div className="stat-card"><span>Total listings</span><strong>{stats.total}</strong></div>
          <div className="stat-card"><span>Admin verified</span><strong>{stats.verified}</strong></div>
          <div className="stat-card"><span>Navigation-ready</span><strong>{stats.navigationReady}</strong></div>
          <div className="stat-card"><span>With Jumu’ah</span><strong>{stats.withJumuah}</strong></div>
          <div className="stat-card"><span>External discoveries</span><strong>{stats.externalDiscovered}</strong></div>
          <div className="stat-card"><span>Need verification</span><strong>{stats.needsVerification}</strong></div>
        </section>

        <section className="dashboard-grid analytics-grid">
          <article className="info-card">
            <h3>Chennai pipeline snapshot</h3>
            <p className="small-text">This is a pipeline snapshot/target number, not a claim that all records are already verified in Firestore.</p>
            <div className="meta-grid">
              <div className="meta-item"><span>Found</span><strong>{chennaiPipelineSnapshot.found}</strong></div>
              <div className="meta-item"><span>Verified</span><strong>{chennaiPipelineSnapshot.verified}</strong></div>
              <div className="meta-item"><span>Jumu’ah timings</span><strong>{chennaiPipelineSnapshot.jumuahTimings}</strong></div>
              <div className="meta-item"><span>Source</span><strong>{chennaiPipelineSnapshot.source}</strong></div>
            </div>
          </article>

          <article className="info-card">
            <h3>Launch warnings</h3>
            {stats.launchWarnings.length ? (
              <ul className="clean-list">
                {stats.launchWarnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            ) : <p className="small-text">No launch warnings for current verified dataset.</p>}
            <div className="cta-row compact-card-actions">
              <Link className="secondary-button" href="/admin/verification">Verification dashboard</Link>
              <Link className="ghost-button" href="/admin/data-pipeline">Data pipeline</Link>
            </div>
          </article>
        </section>

        <section className="info-card">
          <h3>City coverage</h3>
          <div className="table-scroll">
            <table className="admin-table">
              <thead><tr><th>City / Locality</th><th>Total</th><th>Verified</th><th>Nav-ready</th><th>Jumu’ah</th></tr></thead>
              <tbody>
                {stats.byCity.slice(0, 20).map((row) => (
                  <tr key={row.city}>
                    <td>{row.city}</td><td>{row.total}</td><td>{row.verified}</td><td>{row.navigationReady}</td><td>{row.withJumuah}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
