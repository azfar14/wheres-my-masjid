"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { compassSupportMessage, isBrowserSecureContext, locationProblemMessage, readableCurrentUrl } from "@/lib/browserSupport";
import type { Coordinates } from "@/types";

type ProviderHealth = {
  providers: Array<{ id: string; label: string; configured: boolean; role: string; priority: number; setupEnv?: string; advisory?: string }>;
  recommended: string;
};

function formatCoords(coords?: Coordinates): string {
  if (!coords) return "—";
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}

export default function DiagnosticsPage() {
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<ProviderHealth | undefined>();
  const [healthError, setHealthError] = useState<string | undefined>();
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [coords, setCoords] = useState<Coordinates | undefined>();
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [locationMessage, setLocationMessage] = useState<string | undefined>();
  const [compassMessage, setCompassMessage] = useState<string | undefined>();
  const [heading, setHeading] = useState<number | undefined>();

  useEffect(() => {
    setMounted(true);
    fetch("/api/providers/health")
      .then(async (response) => {
        const data = (await response.json()) as ProviderHealth;
        if (!response.ok) throw new Error("Provider health check failed.");
        setHealth(data);
      })
      .catch((error) => setHealthError(error instanceof Error ? error.message : "Could not load provider health."));
  }, []);

  function testLocation() {
    setLocationMessage(undefined);
    setIsCheckingLocation(true);

    if (!("geolocation" in navigator)) {
      setLocationMessage(locationProblemMessage().message);
      setIsCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setAccuracy(position.coords.accuracy);
        setLocationMessage(`Location works. Accuracy: ${Math.round(position.coords.accuracy)} m.`);
        setIsCheckingLocation(false);
      },
      (error) => {
        setLocationMessage(locationProblemMessage(error).message);
        setIsCheckingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 14000, maximumAge: 30000 }
    );
  }

  async function testCompass() {
    const support = compassSupportMessage();
    if (!support.ok) {
      setCompassMessage(support.message);
      return;
    }

    try {
      const orientationConstructor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };

      if (typeof orientationConstructor.requestPermission === "function") {
        const permission = await orientationConstructor.requestPermission();
        if (permission !== "granted") {
          setCompassMessage("Compass permission was denied. Use the Qibla bearing fallback.");
          return;
        }
      }

      let seen = false;
      const handler = (event: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
        const nextHeading = typeof event.webkitCompassHeading === "number"
          ? event.webkitCompassHeading
          : typeof event.alpha === "number"
            ? 360 - event.alpha
            : undefined;
        if (nextHeading !== undefined) {
          seen = true;
          setHeading(((nextHeading % 360) + 360) % 360);
          setCompassMessage("Compass sensor works. Qibla live arrow should work on /qibla.");
        }
      };

      window.addEventListener("deviceorientationabsolute", handler, true);
      window.addEventListener("deviceorientation", handler, true);
      setCompassMessage("Compass permission accepted. Waiting for a heading sample…");

      window.setTimeout(() => {
        if (!seen) setCompassMessage("Permission worked, but this browser did not deliver a heading sample. Qibla still works by bearing number and map line.");
      }, 5000);
    } catch {
      setCompassMessage("Compass test failed. Qibla still works through bearing, place search, and manual coordinates.");
    }
  }

  const secure = mounted ? isBrowserSecureContext() : false;
  const support = mounted ? compassSupportMessage() : { ok: false, message: "Checking…" };

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card diagnostics-hero">
          <p className="kicker">Reliability center</p>
          <h2 className="hero-title">Diagnose location, compass, and masjid discovery before users face problems.</h2>
          <div className="hero-meta">
            <span className="pill">Secure page: {secure ? "Yes" : "No"}</span>
            <span className="pill">Compass: {support.ok ? "Available" : "Fallback"}</span>
            <span className="pill">Location: {coords ? "Working" : "Not tested"}</span>
          </div>
          <div className="cta-row">
            <button className="button" type="button" onClick={testLocation} disabled={isCheckingLocation}>{isCheckingLocation ? "Testing…" : "Test location"}</button>
            <button className="secondary-button" type="button" onClick={() => void testCompass()}>Test compass</button>
            <Link className="ghost-button" href="/nearby">Nearby</Link>
            <Link className="ghost-button" href="/qibla">Qibla</Link>
            <Link className="ghost-button" href="/qa">QA lab</Link>
          </div>
        </section>

        <section className="info-card">
          <h3>Browser status</h3>
          <div className="meta-grid">
            <div className="meta-item"><span>Current URL</span><strong>{mounted ? readableCurrentUrl() : "checking"}</strong></div>
            <div className="meta-item"><span>Location result</span><strong>{formatCoords(coords)}</strong></div>
            <div className="meta-item"><span>Accuracy</span><strong>{accuracy ? `${Math.round(accuracy)} m` : "—"}</strong></div>
            <div className="meta-item"><span>Heading</span><strong>{heading !== undefined ? `${Math.round(heading)}°` : "—"}</strong></div>
          </div>
          {locationMessage && <div className={coords ? "notice success compact" : "notice danger compact"}>{locationMessage}</div>}
          {compassMessage && <div className={heading !== undefined ? "notice success compact" : "notice neutral compact"}>{compassMessage}</div>}
          {!secure && <div className="notice danger compact">Phone location and compass need HTTPS. Deploy to Vercel and test the HTTPS link on your phone.</div>}
        </section>

        <section className="info-card">
          <h3>Provider cascade</h3>
          {healthError && <div className="notice danger compact">{healthError}</div>}
          {health && <p>{health.recommended}</p>}
          <div className="provider-health-grid">
            {health?.providers.map((provider) => (
              <div className={provider.configured ? "provider-health-card" : "provider-health-card muted"} key={provider.id}>
                <span>#{provider.priority} {provider.label}</span>
                <strong>{provider.configured ? "Ready" : "Not configured"}</strong>
                <small>{provider.role}{provider.setupEnv ? ` · Env: ${provider.setupEnv}` : ""}{provider.advisory ? ` · ${provider.advisory}` : ""}</small>
              </div>
            ))}
          </div>
          <p className="small-text">The app should show every loaded masjid with distance after location is available. External provider listings remain unverified until converted into Firestore records.</p>
        </section>

        <section className="info-card">
          <h3>No-trouble launch rule</h3>
          <div className="notice neutral compact">Run the Production QA lab with your exact coordinates before sharing the link. It exposes provider counts, accepted listings, source errors, and launch readiness for that point.</div>
          <ol className="tight-list numbered">
            <li>Deploy to HTTPS before phone Qibla/location testing.</li>
            <li>Add Mappls for India and Foursquare for worldwide POI coverage.</li>
            <li>Keep Firestore as the trusted database for verified jamaat timings.</li>
            <li>Use Diagnostics after every deployment before sharing the link.</li>
          </ol>
        </section>
        <div className="footer-space" />
      </main>
    </>
  );
}
