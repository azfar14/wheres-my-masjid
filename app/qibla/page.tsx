"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import {
  KAABA_COORDINATES,
  calculateQiblaBearing,
  compassDirectionLabel,
  normalizeDegrees,
  qiblaDistanceKm,
  relativeQiblaArrowRotation
} from "@/lib/qibla";
import { compassSupportMessage, isBrowserSecureContext, locationProblemMessage, readableCurrentUrl } from "@/lib/browserSupport";
import { readRememberedLocation, rememberLocation } from "@/lib/locationMemory";
import { accuracyText, accuracyWarning, getBestBrowserLocation, type BrowserLocationResult } from "@/lib/locationAccess";
import { searchPlaces, type PlaceSearchResult } from "@/lib/placeSearchService";
import type { Coordinates } from "@/types";

type CompassPermissionConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type DeviceOrientationWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

function formatDegrees(value: number): string {
  return `${Math.round(normalizeDegrees(value))}°`;
}

function readHeading(event: DeviceOrientationWithCompass): number | undefined {
  if (typeof event.webkitCompassHeading === "number") return normalizeDegrees(event.webkitCompassHeading);
  if (typeof event.alpha === "number") return normalizeDegrees(360 - event.alpha);
  return undefined;
}

function signedAngle(from: number, to: number): number {
  const diff = normalizeDegrees(to - from);
  return diff > 180 ? diff - 360 : diff;
}

function turnInstruction(qiblaBearing?: number, heading?: number): string {
  if (qiblaBearing === undefined) return "Choose your location first.";
  if (heading === undefined) return `Sensorless mode: face ${formatDegrees(qiblaBearing)} ${compassDirectionLabel(qiblaBearing)} from true north using any compass.`;
  const diff = signedAngle(heading, qiblaBearing);
  const amount = Math.abs(Math.round(diff));
  if (amount <= 5) return "You are facing Qibla direction.";
  return diff > 0 ? `Turn right ${amount}°.` : `Turn left ${amount}°.`;
}

function accuracyLabel(value?: number): string {
  if (value === undefined) return "Compass accuracy unknown";
  if (value <= 10) return `Good compass accuracy ±${Math.round(value)}°`;
  if (value <= 25) return `Medium compass accuracy ±${Math.round(value)}°`;
  return `Low compass accuracy ±${Math.round(value)}° — rotate phone in a figure 8`;
}


function angularSpread(samples: number[]): number | undefined {
  if (samples.length < 4) return undefined;
  let widest = 0;
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      widest = Math.max(widest, Math.abs(signedAngle(samples[i], samples[j])));
    }
  }
  return widest;
}

function compassStability(samples: number[], accuracy?: number): { stable: boolean; label: string; helper: string; spread?: number } {
  const spread = angularSpread(samples);
  if (samples.length < 4) {
    return { stable: false, label: "Collecting samples", helper: "Keep the phone flat and rotate slowly once so the app can judge compass stability.", spread };
  }
  if (typeof accuracy === "number" && accuracy > 25) {
    return { stable: false, label: "Recalibrate compass", helper: `Phone reports low compass accuracy (±${Math.round(accuracy)}°). Move away from metal and rotate the phone in a figure-8.`, spread };
  }
  if (spread !== undefined && spread > 12) {
    return { stable: false, label: "Compass unstable", helper: `Recent heading samples vary by about ${Math.round(spread)}°. Use the bearing number or map line until stable.`, spread };
  }
  return { stable: true, label: "Compass stable", helper: "Recent heading samples are stable enough for the live arrow guide.", spread };
}

function qiblaPrecisionGrade(locationAccuracy?: number, compassAccuracy?: number, compassMode?: string): { label: string; helper: string; safeForLiveArrow: boolean } {
  if (!locationAccuracy) {
    return {
      label: "Bearing ready",
      helper: "The mathematical Qibla bearing is ready. Compass precision depends on your phone sensor.",
      safeForLiveArrow: compassMode === "active" && (compassAccuracy === undefined || compassAccuracy <= 25)
    };
  }
  if (locationAccuracy <= 50 && (compassAccuracy === undefined || compassAccuracy <= 15 || compassMode !== "active")) {
    return {
      label: "High confidence",
      helper: `Location accuracy is about ${Math.round(locationAccuracy)} m. Use the degree bearing as the source of truth.`,
      safeForLiveArrow: compassMode === "active" && (compassAccuracy === undefined || compassAccuracy <= 15)
    };
  }
  if (locationAccuracy <= 150) {
    return {
      label: "Good confidence",
      helper: `Location accuracy is about ${Math.round(locationAccuracy)} m. Bearing is usable; verify live compass with calibration.`,
      safeForLiveArrow: compassMode === "active" && (compassAccuracy === undefined || compassAccuracy <= 25)
    };
  }
  return {
    label: "Use fallback",
    helper: `Browser location is coarse (${Math.round(locationAccuracy)} m). Use place/manual coordinates for tighter bearing before relying on the compass arrow.`,
    safeForLiveArrow: false
  };
}

function qiblaLineUrl(location: Coordinates): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${location.lat},${location.lng}`,
    destination: `${KAABA_COORDINATES.lat},${KAABA_COORDINATES.lng}`,
    travelmode: "walking"
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function osmKaabaLineUrl(location: Coordinates): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${location.lat}%2C${location.lng}%3B${KAABA_COORDINATES.lat}%2C${KAABA_COORDINATES.lng}`;
}

function mapsCoordinateHelpUrl(): string {
  return "https://www.google.com/maps/search/?api=1&query=my+location";
}

export default function QiblaPage() {
  const [mounted, setMounted] = useState(false);
  const [location, setLocation] = useState<Coordinates | undefined>();
  const [locationLabel, setLocationLabel] = useState<string | undefined>();
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | undefined>();
  const [locationStatus, setLocationStatus] = useState<string | undefined>();
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | undefined>();
  const [locationSource, setLocationSource] = useState<BrowserLocationResult["source"] | "manual" | "place" | "saved" | undefined>();
  const [heading, setHeading] = useState<number | undefined>();
  const [sensorAccuracy, setSensorAccuracy] = useState<number | undefined>();
  const [headingSamples, setHeadingSamples] = useState<number[]>([]);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassStatus, setCompassStatus] = useState<string | undefined>();
  const [compassMode, setCompassMode] = useState<"not-started" | "waiting" | "active" | "fallback">("not-started");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeError, setPlaceError] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [rememberedLabel, setRememberedLabel] = useState<string | undefined>();
  const headingSeenRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const paramLat = Number(params.get("lat"));
    const paramLng = Number(params.get("lng"));
    const paramLabel = params.get("label") ?? "selected masjid";
    if (Number.isFinite(paramLat) && Number.isFinite(paramLng) && paramLat >= -90 && paramLat <= 90 && paramLng >= -180 && paramLng <= 180) {
      applyLocation({ lat: paramLat, lng: paramLng }, paramLabel, "Qibla calculated from the selected masjid/profile pin.", { source: "manual" });
      return;
    }

    const remembered = readRememberedLocation();
    if (remembered) {
      const label = remembered.label ?? `${remembered.coordinates.lat.toFixed(4)}, ${remembered.coordinates.lng.toFixed(4)}`;
      setRememberedLabel(label);
      applyLocation(remembered.coordinates, label, "Using your last saved location. Tap Use my location to refresh it.", { source: "saved" });
    }
  }, []);

  const qiblaBearing = useMemo(() => (location ? calculateQiblaBearing(location) : undefined), [location]);
  const arrowRotation = useMemo(
    () => (qiblaBearing !== undefined ? relativeQiblaArrowRotation(qiblaBearing, heading) : 0),
    [heading, qiblaBearing]
  );
  const distance = useMemo(() => (location ? qiblaDistanceKm(location) : undefined), [location]);
  const instruction = turnInstruction(qiblaBearing, heading);
  const qiblaCardLabel = qiblaBearing !== undefined ? `${formatDegrees(qiblaBearing)} ${compassDirectionLabel(qiblaBearing)}` : "—";
  const secure = mounted ? isBrowserSecureContext() : false;
  const support = mounted ? compassSupportMessage() : { ok: false, message: "Checking phone support…" };
  const stability = useMemo(() => compassStability(headingSamples, sensorAccuracy), [headingSamples, sensorAccuracy]);
  const precisionGrade = qiblaPrecisionGrade(locationAccuracyMeters, sensorAccuracy, compassMode);
  const liveArrowTrusted = precisionGrade.safeForLiveArrow && (compassMode !== "active" || stability.stable);

  function applyLocation(coords: Coordinates, label: string, status?: string, meta?: { accuracyMeters?: number; source?: BrowserLocationResult["source"] | "manual" | "place" | "saved" }) {
    setLocation(coords);
    setManualLat(String(Number(coords.lat.toFixed(6))));
    setManualLng(String(Number(coords.lng.toFixed(6))));
    setLocationLabel(label);
    setLocationStatus(status);
    setLocationAccuracyMeters(meta?.accuracyMeters);
    setLocationSource(meta?.source);
    setLocationError(undefined);
    rememberLocation(coords, label);
    setRememberedLabel(label);
  }

  async function requestLocation() {
    setLocationError(undefined);
    setLocationStatus(undefined);

    if (!secure) {
      setLocationStatus("This page is not HTTPS, so the browser may block phone location. Trying once anyway; use place search/manual coordinates if it fails.");
    }
    if (!("geolocation" in navigator)) {
      setLocationError(locationProblemMessage().message);
      return;
    }

    setIsLocating(true);
    try {
      setLocationStatus("Trying high-accuracy GPS/Wi‑Fi location, then relaxed fallback if needed…");
      const result = await getBestBrowserLocation();
      applyLocation(result.coordinates, "your current location", accuracyText(result), { accuracyMeters: result.accuracyMeters, source: result.source });
      const warning = accuracyWarning(result);
      if (warning) setLocationError(warning);
    } catch (error) {
      setLocationError(locationProblemMessage(error as GeolocationPositionError).message);
    } finally {
      setIsLocating(false);
    }
  }

  function useRememberedLocation() {
    const remembered = readRememberedLocation();
    if (!remembered) {
      setLocationError("No saved location yet. Use Nearby search or search a place below.");
      return;
    }
    applyLocation(remembered.coordinates, remembered.label ?? "saved nearby location", `Using saved location from ${new Date(remembered.savedAt).toLocaleString()}`, { source: "saved" });
  }

  async function enableCompass() {
    setCompassStatus(undefined);
    setHeadingSamples([]);
    setSensorAccuracy(undefined);
    headingSeenRef.current = false;

    const currentSupport = compassSupportMessage();
    if (!currentSupport.ok) {
      setCompassMode("fallback");
      setCompassStatus(currentSupport.message);
      return;
    }

    try {
      const orientationConstructor = window.DeviceOrientationEvent as CompassPermissionConstructor;
      if (typeof orientationConstructor.requestPermission === "function") {
        const permission = await orientationConstructor.requestPermission();
        if (permission !== "granted") {
          setCompassMode("fallback");
          setCompassStatus("Compass permission was denied. Use the true-north bearing with your phone’s native compass app.");
          return;
        }
      }

      const handler = (event: Event) => {
        const orientation = event as DeviceOrientationWithCompass;
        const nextHeading = readHeading(orientation);
        if (nextHeading !== undefined) {
          headingSeenRef.current = true;
          setHeading(nextHeading);
          setHeadingSamples((current) => [...current.slice(-9), nextHeading]);
          setCompassMode("active");
          setCompassStatus("Live compass is active. Keep the phone flat and rotate slowly.");
        }
        if (typeof orientation.webkitCompassAccuracy === "number") setSensorAccuracy(orientation.webkitCompassAccuracy);
      };

      window.addEventListener("deviceorientationabsolute", handler, true);
      window.addEventListener("deviceorientation", handler, true);
      setCompassEnabled(true);
      setCompassMode("waiting");
      setCompassStatus("Compass permission accepted. Waiting for the first heading sample…");

      window.setTimeout(() => {
        if (!headingSeenRef.current) {
          setCompassMode("fallback");
          setCompassStatus("Compass permission worked, but the browser did not send a heading sample. This is common on some phones/browsers. Use the bearing number with your native compass app.");
        }
      }, 4500);
    } catch {
      setCompassEnabled(false);
      setCompassMode("fallback");
      setCompassStatus("Could not start compass sensors. Use the true-north bearing shown here with your phone’s native compass app.");
    }
  }

  async function searchPlace() {
    setPlaceError(undefined);
    setIsSearchingPlace(true);

    try {
      const results = await searchPlaces(placeQuery);
      setPlaceResults(results);
      if (results[0]) usePlaceResult(results[0]);
    } catch (error) {
      setPlaceError(error instanceof Error ? error.message : "Could not search that place.");
    } finally {
      setIsSearchingPlace(false);
    }
  }

  function usePlaceResult(place: PlaceSearchResult) {
    applyLocation(place.coordinates, place.name, "Qibla calculated from searched place.", { source: "place" });
  }

  function useManualCoordinates() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setLocationError("Enter valid latitude and longitude values.");
      return;
    }
    applyLocation({ lat, lng }, "manual coordinates", "Qibla calculated from manual coordinates.", { source: "manual" });
  }

  async function copyBearing() {
    if (qiblaBearing === undefined) return;
    try {
      await navigator.clipboard.writeText(`Qibla: ${formatDegrees(qiblaBearing)} ${compassDirectionLabel(qiblaBearing)} from true north`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card qibla-hero upgraded-qibla-hero ultra-qibla-hero qibla-command-hero">
          <p className="kicker">Qibla precision studio</p>
          <h2 className="hero-title">Professional Qibla bearing, live compass when supported, and reliable fallbacks when sensors fail.</h2>
          <div className="hero-meta">
            {qiblaBearing !== undefined ? <span className="pill">Qibla {qiblaCardLabel}</span> : <span className="pill">Location needed</span>}
            {distance !== undefined && <span className="pill">{Math.round(distance).toLocaleString()} km to Makkah</span>}
            <span className="pill">{compassMode === "active" ? "Live compass" : "Sensorless fallback"}</span>
            <span className="pill">{precisionGrade.label}</span>
          </div>
          <div className="cta-row">
            <button className="button" type="button" onClick={() => void requestLocation()} disabled={isLocating}>{isLocating ? "Locating…" : "Use my location"}</button>
            <button className="secondary-button" type="button" onClick={() => void enableCompass()}>Enable compass</button>
            {rememberedLabel && <button className="ghost-button" type="button" onClick={useRememberedLocation}>Use saved location</button>}
          </div>
        </section>

        <section className="info-card phone-readiness-card qibla-readiness-pro qibla-command-panel">
          <h3>Phone readiness</h3>
          <div className="meta-grid">
            <div className="meta-item"><span>Secure page</span><strong>{secure ? "Yes" : "No"}</strong></div>
            <div className="meta-item"><span>Compass API</span><strong>{support.ok ? "Available" : "Fallback"}</strong></div>
            <div className="meta-item"><span>Mode</span><strong>{compassMode.replace("-", " ")}</strong></div>
            <div className="meta-item"><span>Compass stability</span><strong>{compassMode === "active" ? stability.label : "fallback"}</strong></div>
            <div className="meta-item"><span>Location source</span><strong>{locationSource ?? "none"}</strong></div>
            <div className="meta-item"><span>Location accuracy</span><strong>{locationAccuracyMeters ? `${Math.round(locationAccuracyMeters)} m` : "—"}</strong></div>
          </div>
          <p className="small-text">{support.message}</p>
          {!secure && <div className="notice compact danger">Open the deployed HTTPS site on your phone. Browser security blocks phone location/compass on local network URLs like 192.168.x.x.</div>}
          <p className="small-text">Current URL: {mounted ? readableCurrentUrl() : "checking…"}</p>
        </section>

        <section className="qibla-mode-grid" aria-label="Qibla fallback modes">
          <article className="qibla-mode-card active">
            <span>01</span>
            <strong>Location + bearing</strong>
            <p>Most reliable mode: once location is known, the degree value works even when phone compass sensors fail.</p>
          </article>
          <article className={compassMode === "active" ? "qibla-mode-card active" : "qibla-mode-card"}>
            <span>02</span>
            <strong>Live phone compass</strong>
            <p>Works only when the browser sends heading data. The interface falls back gracefully if it does not.</p>
          </article>
          <article className="qibla-mode-card">
            <span>03</span>
            <strong>Map line to Kaaba</strong>
            <p>Use the Google/OSM line buttons for a visual reference when sensors are unreliable or unavailable.</p>
          </article>
        </section>

        <section className="info-card qibla-calibration-card">
          <h3>Zero-confusion Qibla safety</h3>
          <p className="small-text">The Qibla bearing calculation is mathematical. The live compass arrow depends on phone sensors, so this page only treats it as reliable when location accuracy, compass accuracy, and heading stability are acceptable.</p>
          <div className="meta-grid">
            <div className="meta-item"><span>Live arrow trust</span><strong>{liveArrowTrusted ? "Ready" : "Use bearing/map line"}</strong></div>
            <div className="meta-item"><span>Samples</span><strong>{headingSamples.length}</strong></div>
            <div className="meta-item"><span>Spread</span><strong>{stability.spread !== undefined ? `${Math.round(stability.spread)}°` : "—"}</strong></div>
          </div>
        </section>

        {locationStatus && <div className="notice success compact">{locationStatus}</div>}
        {locationError && <div className="notice danger compact">{locationError}</div>}
        {compassStatus && <div className={compassMode === "active" ? "notice success compact" : "notice neutral compact"}>{compassStatus}</div>}
        {qiblaBearing !== undefined && (
          <div className={liveArrowTrusted ? "notice success compact" : "notice neutral compact"}>
            <strong>{precisionGrade.label}:</strong> {precisionGrade.helper} {compassMode === "active" && !liveArrowTrusted ? ` ${stability.helper}` : ""}
          </div>
        )}

        <section className="qibla-studio-card qibla-pro-card qibla-control-room">
          <div className="qibla-main-readout">
            <span>True-north Qibla bearing</span>
            <strong>{qiblaCardLabel}</strong>
            <p>{instruction}</p>
          </div>

          <div className="qibla-compass-stage">
            <div className="compass-dial premium-compass precision-compass" aria-label="Qibla compass">
              <span className="compass-north">N</span>
              <span className="compass-east">E</span>
              <span className="compass-south">S</span>
              <span className="compass-west">W</span>
              <span className="degree-tick tick-0">0°</span>
              <span className="degree-tick tick-90">90°</span>
              <span className="degree-tick tick-180">180°</span>
              <span className="degree-tick tick-270">270°</span>
              <div className="kaaba-dot">Kaaba</div>
              <div className="qibla-arrow premium-arrow" style={{ transform: `rotate(${arrowRotation}deg)` }}>
                <span>↑</span>
              </div>
            </div>
          </div>

          <div className="qibla-stats-grid">
            <div className="meta-item"><span>Bearing</span><strong>{qiblaBearing !== undefined ? formatDegrees(qiblaBearing) : "—"}</strong></div>
            <div className="meta-item"><span>Phone heading</span><strong>{heading !== undefined ? formatDegrees(heading) : "—"}</strong></div>
            <div className="meta-item"><span>Compass accuracy</span><strong>{sensorAccuracy !== undefined ? `±${Math.round(sensorAccuracy)}°` : compassEnabled ? "waiting" : "fallback"}</strong></div>
            <div className="meta-item"><span>Stability</span><strong>{compassMode === "active" ? stability.label : "fallback"}</strong></div>
            <div className="meta-item"><span>Location</span><strong>{locationAccuracyMeters ? `${Math.round(locationAccuracyMeters)} m` : "manual/place"}</strong></div>
          </div>

          <div className="notice compact neutral">
            {accuracyLabel(sensorAccuracy)}. {compassMode === "active" ? stability.helper : "The bearing number is the reliable fallback; the live arrow depends on your phone/browser compass sensor."} For best results, stand away from metal, hold the phone flat, and rotate it slowly once.
          </div>

          <div className="card-actions three-actions">
            <button className="ghost-button" type="button" onClick={() => void copyBearing()} disabled={qiblaBearing === undefined}>{copied ? "Copied" : "Copy bearing"}</button>
            {location ? <a className="ghost-button" href={qiblaLineUrl(location)} target="_blank" rel="noreferrer">Google line</a> : <a className="ghost-button" href={mapsCoordinateHelpUrl()} target="_blank" rel="noreferrer">Find coordinates</a>}
            {location ? <a className="secondary-button" href={osmKaabaLineUrl(location)} target="_blank" rel="noreferrer">OSM line</a> : <Link className="secondary-button" href="/nearby">Find masjid</Link>}
          </div>
        </section>

        <section className="filter-card qibla-fallback-card">
          <h3>Fallbacks that always keep Qibla usable</h3>
          <label>
            Search a place
            <div className="input-action-row">
              <input
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchPlace();
                  }
                }}
                placeholder="Example: Chennai, London, New York, your street"
              />
              <button className="ghost-button" type="button" onClick={() => void searchPlace()} disabled={isSearchingPlace || !placeQuery.trim()}>
                {isSearchingPlace ? "Searching…" : "Search"}
              </button>
            </div>
          </label>

          {placeResults.length > 1 && (
            <div className="place-result-grid">
              {placeResults.slice(0, 4).map((place) => (
                <button className="place-result" key={place.id} type="button" onClick={() => usePlaceResult(place)}>
                  <strong>{place.name}</strong>
                  <span>{place.displayName}</span>
                </button>
              ))}
            </div>
          )}

          {placeError && <div className="notice danger compact">{placeError}</div>}
          {locationLabel && <p className="small-text">Qibla calculated for {locationLabel}.</p>}

          <div className="field-grid qibla-manual-grid">
            <label>
              Latitude
              <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="13.0827" inputMode="decimal" />
            </label>
            <label>
              Longitude
              <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} placeholder="80.2707" inputMode="decimal" />
            </label>
          </div>
          <button className="ghost-button full" type="button" onClick={useManualCoordinates}>Use manual coordinates</button>
        </section>

        <section className="info-card qibla-tips">
          <h3>Accuracy checklist</h3>
          <ol className="tight-list numbered">
            <li>For phone location/compass, open the deployed HTTPS website, not a local 192.168.x.x development URL.</li>
            <li>Tap <strong>Use my location</strong>. If it fails, search your area or paste manual coordinates.</li>
            <li>Tap <strong>Enable compass</strong> only after the page has a location.</li>
            <li>If the live arrow fails, use the large bearing number with your native compass app.</li>
            <li>Keep the phone flat and away from metal, chargers, speakers, vehicles, and magnets.</li>
          </ol>
        </section>

        <div className="footer-space" />
      </main>
    </>
  );
}
