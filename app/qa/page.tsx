"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { accuracyText, accuracyWarning, getBestBrowserLocation } from "@/lib/locationAccess";
import { locationProblemMessage } from "@/lib/browserSupport";
import type { Coordinates } from "@/types";

type DebugCandidate = {
  id: string;
  name: string;
  source?: string;
  verificationStatus: string;
  distanceKm: number;
  distanceMeters: number;
  trustScore: number;
  trustLabel: string;
  timingStatus: string;
  quality?: string;
  confidence?: number;
  reason: string;
  coordinates: Coordinates;
  exactPin?: string;
  provider?: string;
  reachHeadline?: string;
  reachDetail?: string;
  smartRankScore?: number;
};

type DebugProvider = {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  count: number;
  durationMs?: number;
  status: "ready" | "not-configured" | "skipped" | "error";
  message?: string;
  error?: string;
  diagnostics: string[];
  accepted: DebugCandidate[];
};

type DebugResponse = {
  generatedAt: string;
  searchCenter: Coordinates;
  radiusKm: number;
  durationMs: number;
  providerCascade: DebugProvider[];
  finalCount: number;
  finalCandidates: DebugCandidate[];
  advice: string[];
  launchGate: { ready: boolean; summary: string };
  error?: string;
};

function formatDistance(candidate: DebugCandidate): string {
  return candidate.distanceMeters < 1000 ? `${candidate.distanceMeters} m` : `${candidate.distanceKm.toFixed(1)} km`;
}

function providerClass(provider: DebugProvider): string {
  if (provider.status === "ready") return "qa-provider-card ready";
  if (provider.status === "error") return "qa-provider-card error";
  if (provider.status === "not-configured") return "qa-provider-card muted";
  return "qa-provider-card warning";
}

export default function ProductionQaPage() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("5");
  const [isLocating, setIsLocating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [debug, setDebug] = useState<DebugResponse | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qLat = params.get("lat");
    const qLng = params.get("lng");
    const qRadius = params.get("radiusKm");
    if (qLat) setLat(qLat);
    if (qLng) setLng(qLng);
    if (qRadius) setRadiusKm(qRadius);
  }, []);

  const coordinateReady = useMemo(() => {
    const latNumber = Number(lat);
    const lngNumber = Number(lng);
    return Number.isFinite(latNumber) && Number.isFinite(lngNumber) && latNumber >= -90 && latNumber <= 90 && lngNumber >= -180 && lngNumber <= 180;
  }, [lat, lng]);

  async function useLocation() {
    setError(undefined);
    setLocationMessage(undefined);
    setIsLocating(true);
    try {
      const result = await getBestBrowserLocation();
      setLat(String(Number(result.coordinates.lat.toFixed(6))));
      setLng(String(Number(result.coordinates.lng.toFixed(6))));
      setLocationMessage([accuracyText(result), accuracyWarning(result)].filter(Boolean).join(" — "));
    } catch (locationError) {
      setLocationMessage(locationProblemMessage(locationError as GeolocationPositionError).message);
    } finally {
      setIsLocating(false);
    }
  }

  async function runProviderAudit() {
    if (!coordinateReady) {
      setError("Enter valid latitude and longitude first.");
      return;
    }

    setError(undefined);
    setDebug(undefined);
    setIsRunning(true);

    try {
      const params = new URLSearchParams({ lat, lng, radiusKm });
      const response = await fetch(`/api/providers/debug?${params.toString()}`);
      const data = (await response.json()) as DebugResponse;
      if (!response.ok) throw new Error(data.error || `Provider audit failed (${response.status}).`);
      setDebug(data);
    } catch (auditError) {
      setError(auditError instanceof Error ? auditError.message : "Provider audit failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card qa-hero">
          <p className="kicker">Production QA lab</p>
          <h2 className="hero-title">See exactly why nearby masjids are found, missed, accepted, or rejected.</h2>
          <p className="hero-copy">Use this before launch and whenever a user says “a masjid near me is missing.” It shows provider health, raw accepted candidates, distance ranking, errors, and next actions.</p>
          <div className="cta-row">
            <button className="button" type="button" onClick={() => void useLocation()} disabled={isLocating}>{isLocating ? "Locating…" : "Use my location"}</button>
            <button className="secondary-button" type="button" onClick={() => void runProviderAudit()} disabled={isRunning || !coordinateReady}>{isRunning ? "Auditing…" : "Run provider audit"}</button>
            <Link className="ghost-button" href="/nearby">Back to nearby</Link>
          </div>
        </section>

        <section className="filter-card qa-control-card">
          <h3>Search coordinate</h3>
          <div className="field-grid">
            <label>
              Latitude
              <input value={lat} onChange={(event) => setLat(event.target.value)} placeholder="13.0827" inputMode="decimal" />
            </label>
            <label>
              Longitude
              <input value={lng} onChange={(event) => setLng(event.target.value)} placeholder="80.2707" inputMode="decimal" />
            </label>
            <label>
              Radius
              <select value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)}>
                {[1, 2, 5, 10, 25, 50].map((radius) => <option value={radius} key={radius}>{radius} km</option>)}
              </select>
            </label>
          </div>
          {locationMessage && <div className="notice neutral compact">{locationMessage}</div>}
          {error && <div className="notice danger compact">{error}</div>}
          <p className="small-text">Provider keys stay server-side. This page never exposes Mappls or Foursquare credentials.</p>
        </section>

        {debug && (
          <>
            <section className={debug.launchGate.ready ? "info-card qa-launch-card ready" : "info-card qa-launch-card warning"}>
              <h3>{debug.launchGate.ready ? "Launch gate passed for this coordinate" : "Launch gate needs work for this coordinate"}</h3>
              <p>{debug.launchGate.summary}</p>
              <div className="meta-grid">
                <div className="meta-item"><span>Final candidates</span><strong>{debug.finalCount}</strong></div>
                <div className="meta-item"><span>Radius</span><strong>{debug.radiusKm} km</strong></div>
                <div className="meta-item"><span>Server time</span><strong>{debug.durationMs} ms</strong></div>
              </div>
            </section>

            <section className="info-card">
              <h3>Provider cascade result</h3>
              <div className="qa-provider-grid">
                {debug.providerCascade.map((provider) => (
                  <article className={providerClass(provider)} key={provider.id}>
                    <span>{provider.label}</span>
                    <strong>{provider.count} found</strong>
                    <small>Status: {provider.status}{provider.durationMs ? ` · ${provider.durationMs} ms` : ""}</small>
                    {provider.message && <small>{provider.message}</small>}
                    {provider.error && <small className="qa-error-text">{provider.error}</small>}
                    {provider.diagnostics.length > 0 && <small>{provider.diagnostics.slice(0, 6).join(" · ")}</small>}
                  </article>
                ))}
              </div>
            </section>

            <section className="info-card">
              <h3>Final distance ranking</h3>
              <p className="small-text">These are the candidates the engine accepted, sorted by nearest first. Unverified results are for navigation only until jamaat timings are verified.</p>
              <div className="qa-candidate-list">
                {debug.finalCandidates.map((candidate, index) => (
                  <article className="qa-candidate-card" key={`${candidate.provider}-${candidate.id}-${index}`}>
                    <div>
                      <strong>#{index + 1} {candidate.name}</strong>
                      <span>{candidate.provider} · {formatDistance(candidate)} · Trust {candidate.trustScore}</span>
                    </div>
                    <p>{candidate.reason}</p>
                    {candidate.reachHeadline && <p><strong>{candidate.reachHeadline}</strong> · {candidate.reachDetail}</p>}
                    <small>{candidate.timingStatus} · Smart score {candidate.smartRankScore ?? "—"} · {candidate.coordinates.lat.toFixed(6)}, {candidate.coordinates.lng.toFixed(6)}</small>
                    {candidate.exactPin && <a className="ghost-button compact-button" href={candidate.exactPin} target="_blank" rel="noreferrer">Open exact pin</a>}
                  </article>
                ))}
                {debug.finalCandidates.length === 0 && <div className="notice danger compact">No provider produced accepted candidates for this coordinate.</div>}
              </div>
            </section>

            <section className="info-card">
              <h3>What to fix next</h3>
              <ol className="tight-list numbered">
                {debug.advice.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </section>
          </>
        )}

        <section className="info-card">
          <h3>Production rule</h3>
          <p>Do not release a city until this QA page returns at least a few nearby candidates for multiple test coordinates, and verified Firestore listings exist for the most important local masjids.</p>
        </section>
        <div className="footer-space" />
      </main>
    </>
  );
}
