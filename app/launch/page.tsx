"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { useMasjids } from "@/hooks/useMasjids";
import { launchReadinessFor } from "@/lib/launchVerification";

function statusText(status: string): string {
  if (status === "local_launch_ready") return "Local beta ready";
  if (status === "private_beta") return "Private beta only";
  return "Not launch ready";
}

export default function LaunchPage() {
  const { masjids, source, message, isLoading } = useMasjids({ includeLegacyDemoRecords: false });
  const readiness = launchReadinessFor(masjids);

  const checklist = [
    { label: "10+ verified masjid pins in the first launch area", done: readiness.verifiedCount >= 10 },
    { label: "10+ verified jamaat timing sets", done: readiness.verifiedWithTimingsCount >= 10 },
    { label: "External provider discovery passes in /qa", done: true, note: "Run /qa for your exact coordinates before inviting users." },
    { label: "Google navigation tested for every verified masjid", done: false, note: "Open every verified listing and test the Start nav button." },
    { label: "Qibla tested on phone HTTPS", done: false, note: "Deploy to Vercel first; do not judge Qibla from local LAN." },
    { label: "Firestore rules published", done: false },
    { label: "3–5 real users tested nearby + navigation", done: false }
  ];

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card network-hero">
          <p className="kicker">Launch readiness</p>
          <h2 className="hero-title">Navigation trust gate.</h2>
          <p className="hero-copy">This page keeps the app from going public while it still depends on unverified provider pins.</p>
          <div className="hero-meta">
            <span className="pill">{statusText(readiness.status)}</span>
            <span className="pill">{readiness.score}/100 score</span>
            <span className="pill">{readiness.verifiedCount} verified pins</span>
          </div>
        </section>

        <DataStatus source={source} message={message} isLoading={isLoading} />

        <section className="info-card">
          <h3>Navigation rule</h3>
          <div className="notice warning-soft">
            Verified Firestore listings and Google Place ID listings can open direct navigation. Foursquare, Mappls, and OSM discovery results open Google Maps search first so the user can choose the real mosque listing before following Directions.
          </div>
          <div className="meta-grid">
            <div className="meta-item"><span>Verified pins</span><strong>{readiness.verifiedCount}</strong></div>
            <div className="meta-item"><span>Verified timings</span><strong>{readiness.verifiedWithTimingsCount}</strong></div>
            <div className="meta-item"><span>Need verification</span><strong>{readiness.needsVerificationCount}</strong></div>
          </div>
        </section>

        <section className="form-card">
          <h3>Go / no-go checklist</h3>
          {checklist.map((item) => (
            <article className={item.done ? "launch-check done" : "launch-check"} key={item.label}>
              <strong>{item.done ? "✓" : "○"} {item.label}</strong>
              {item.note && <p>{item.note}</p>}
            </article>
          ))}
        </section>

        <section className="form-card">
          <h3>Exact-pin verification workflow</h3>
          <ol className="tight-list numbered-list">
            <li>Find the real masjid in Google Maps.</li>
            <li>Copy the coordinates or a link containing <code>@lat,lng</code>.</li>
            <li>Open Admin → Add/edit listing.</li>
            <li>Paste it into “Google Maps link / copied coordinates”.</li>
            <li>Click “Extract exact pin from Maps link”.</li>
            <li>Save, test navigation, then mark the listing admin verified.</li>
          </ol>
          <div className="cta-row">
            <Link className="button" href="/admin">Open admin</Link>
            <Link className="secondary-button" href="/qa">Run QA</Link>
            <Link className="ghost-button" href="/nearby">Test nearby</Link>
          </div>
        </section>

        <section className="info-card">
          <h3>Public user behavior</h3>
          <div className="network-grid">
            <div className="timing-cell"><span>Verified listing</span><strong>Start nav</strong></div>
            <div className="timing-cell"><span>External listing</span><strong>Verify & navigate</strong></div>
            <div className="timing-cell"><span>Wrong pin</span><strong>User suggests correction</strong></div>
            <div className="timing-cell"><span>After approval</span><strong>Trusted Firestore listing</strong></div>
          </div>
        </section>

        <div className="footer-space" />
      </main>
    </>
  );
}
