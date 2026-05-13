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

// ================== ALL HELPER FUNCTIONS ==================
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

// ... (Keep all other helper functions like qiblaLineUrl, etc. if you use them)

export default function QiblaPage() {
  const [mounted, setMounted] = useState(false);
  const [notifyClicked, setNotifyClicked] = useState(false);

  // Original states
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

  // ... Paste all your original useEffect, applyLocation, requestLocation, enableCompass, searchPlace, etc. functions here ...

  const qiblaBearing = useMemo(() => (location ? calculateQiblaBearing(location) : undefined), [location]);
  const arrowRotation = useMemo(() => (qiblaBearing !== undefined ? relativeQiblaArrowRotation(qiblaBearing, heading) : 0), [heading, qiblaBearing]);
  const distance = useMemo(() => (location ? qiblaDistanceKm(location) : undefined), [location]);
  const instruction = turnInstruction(qiblaBearing, heading);
  const qiblaCardLabel = qiblaBearing !== undefined ? `${formatDegrees(qiblaBearing)} ${compassDirectionLabel(qiblaBearing)}` : "—";
  const secure = mounted ? isBrowserSecureContext() : false;
  const support = mounted ? compassSupportMessage() : { ok: false, message: "Checking phone support…" };
  const stability = useMemo(() => compassStability(headingSamples, sensorAccuracy), [headingSamples, sensorAccuracy]);
  const precisionGrade = qiblaPrecisionGrade(locationAccuracyMeters, sensorAccuracy, compassMode);
  const liveArrowTrusted = precisionGrade.safeForLiveArrow && (compassMode !== "active" || stability.stable);

  const handleNotifyMe = () => {
    setNotifyClicked(true);
    setTimeout(() => {
      alert("Thank you! We'll notify you as soon as the improved Qibla feature is ready.");
      setNotifyClicked(false);
    }, 800);
  };

  return (
    <>
      <AppHeader />

      <main className="relative">
        {/* LIGHT TRANSLUCENT OVERLAY */}
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="text-center px-6 max-w-md">
            <div className="mx-auto mb-6 w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center border border-white/30">
              <span className="text-5xl">🕋</span>
            </div>

            <h2 className="text-3xl font-semibold text-white mb-2 tracking-tight">
              Work in Progress
            </h2>
            
            <p className="text-white/95 text-[17px] leading-relaxed mb-8">
              Our team is actively working on a much better Qibla experience with improved accuracy and new features.
            </p>

            <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 text-sm px-5 py-2.5 rounded-2xl border border-white/20 backdrop-blur-md mb-8">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Coming Soon
            </div>

            <button
              onClick={handleNotifyMe}
              disabled={notifyClicked}
              className="w-full bg-white text-black font-medium py-3.5 rounded-2xl hover:bg-white/95 transition-all active:scale-[0.985] disabled:opacity-70 shadow-lg"
            >
              {notifyClicked ? "Thank you ✨" : "Notify Me When Ready"}
            </button>

            <p className="text-white/70 text-sm mt-6">
              Thank you for your patience
            </p>
          </div>
        </div>

        {/* HERO SECTION */}
        <section className="hero-card qibla-hero upgraded-qibla-hero ultra-qibla-hero qibla-command-hero pointer-events-none">
          <p className="kicker">Easy Qibla compass</p>
          <h2 className="hero-title">A simple Qibla compass with a clear Kaaba marker that is easy to follow on your phone.</h2>

          <div className="hero-meta">
            {qiblaBearing !== undefined ? <span className="pill">Qibla {qiblaCardLabel}</span> : <span className="pill">Location needed</span>}
            {distance !== undefined && <span className="pill">{Math.round(distance).toLocaleString()} km to Makkah</span>}
            <span className="pill">{compassMode === "active" ? "Compass on" : "Bearing mode"}</span>
            <span className="pill">{precisionGrade.label}</span>
          </div>

          <div className="cta-row qibla-hero-actions">
            <button className="button opacity-70 cursor-not-allowed" type="button" disabled>Use my location</button>
            <button className="secondary-button opacity-70 cursor-not-allowed" type="button" disabled>Start compass</button>
            {rememberedLabel && <button className="ghost-button qibla-saved-action opacity-70 cursor-not-allowed" type="button" disabled>Use saved location</button>}
          </div>

          <div className="qibla-step-strip pointer-events-none">
            <div className="qibla-step"><strong>1</strong><span>Get your location</span></div>
            <div className="qibla-step"><strong>2</strong><span>Start the compass</span></div>
            <div className="qibla-step"><strong>3</strong><span>Turn until the Kaaba marker is straight ahead</span></div>
          </div>
        </section>

        {/* Add pointer-events-none opacity-95 to all other sections as needed */}
        {/* Paste the rest of your original sections here (info-card, qibla-studio-card, filter-card, etc.) */}

        <div className="footer-space" />
      </main>
    </>
  );
}