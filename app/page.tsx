"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { LocationStatus } from "@/components/LocationStatus";
import { MasjidCard } from "@/components/MasjidCard";
import { AdSlot } from "@/components/AdSlot";
import { useMasjids } from "@/hooks/useMasjids";
import { saveDiscoveredMasjids } from "@/lib/discoveredMasjidStorage";
import { displayDistanceKm, distanceKm, formatDistance, walkingMinutes } from "@/lib/geo";
import { getMasjidNavigationAction } from "@/lib/navigationTrust";
import { formatCountdown, getNextJamaat } from "@/lib/jamaat";
import { discoverPrecisionMasjids } from "@/lib/precisionDiscovery";
import { mergeMasjidSources } from "@/lib/osmMasjidService";
import { hasVerifiedTimings, listingQualityPenalty } from "@/lib/verification";
import { evaluateJamaatReach, rankMasjidsForJamaat } from "@/lib/smartRanking";
import { displayMasjidLocality, displayMasjidName, displaySourceBadge, displayVerificationNotice, sourceClassName } from "@/lib/masjidDisplay";
import { isBrowserSecureContext, locationProblemMessage } from "@/lib/browserSupport";
import { accuracyText, accuracyWarning, getBestBrowserLocation } from "@/lib/locationAccess";
import { rememberLocation } from "@/lib/locationMemory";
import type { Coordinates, Masjid } from "@/types";

type MasjidWithDistance = {
  masjid: Masjid;
  distance?: number;
};

export default function HomePage() {
  const { masjids, source, message, isLoading } = useMasjids();
  const [location, setLocation] = useState<Coordinates | undefined>();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | undefined>();
  const [discoveredMasjids, setDiscoveredMasjids] = useState<Masjid[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | undefined>();
  const [discoveryError, setDiscoveryError] = useState<string | undefined>();

  async function discoverNearby(coords: Coordinates) {
    setIsDiscovering(true);
    setDiscoveryError(undefined);
    setDiscoveryMessage(undefined);

    try {
      const radiusUsed = 5;
      const result = await discoverPrecisionMasjids(coords, radiusUsed);
      const nearbyOnly = mergeMasjidSources([], result.masjids, coords)
        .filter((masjid) => (displayDistanceKm(coords, masjid) ?? distanceKm(coords, masjid.coordinates)) <= radiusUsed)
        .sort((a, b) => (displayDistanceKm(coords, a) ?? distanceKm(coords, a.coordinates)) - (displayDistanceKm(coords, b) ?? distanceKm(coords, b.coordinates)));

      setDiscoveredMasjids(nearbyOnly);
      saveDiscoveredMasjids(nearbyOnly);
      setDiscoveryMessage(
        nearbyOnly.length
          ? `Mappls/Foursquare discovery checked ${radiusUsed} km and found ${nearbyOnly.length} nearby listing${nearbyOnly.length === 1 ? "" : "s"}.`
          : `Mappls/Foursquare discovery checked ${radiusUsed} km. Try Nearby for a wider radius or report the exact pin.`
      );
      if (result.errors.length || result.diagnostics.length) setDiscoveryError([...result.errors, ...result.diagnostics.slice(0, 5)].join(" · "));
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : "Could not search precision provider layers.");
    } finally {
      setIsDiscovering(false);
    }
  }

  async function requestLocation() {
    setLocationError(undefined);

    if (!("geolocation" in navigator)) {
      setLocationError(locationProblemMessage().message);
      return;
    }

    if (!isBrowserSecureContext()) {
      setLocationError("This phone URL is not HTTPS, so the browser may block location. Trying once anyway; deploy to HTTPS for reliable phone testing.");
    }

    setIsLocating(true);
    try {
      const result = await getBestBrowserLocation();
      const coords = result.coordinates;
      setLocation(coords);
      rememberLocation(coords, "your current location");
      setLocationError([accuracyText(result), accuracyWarning(result)].filter(Boolean).join(" — "));
      void discoverNearby(coords);
    } catch (error) {
      setLocationError(locationProblemMessage(error as GeolocationPositionError).message);
    } finally {
      setIsLocating(false);
    }
  }

  const allMasjids = useMemo(
    () => mergeMasjidSources(masjids, discoveredMasjids, location),
    [discoveredMasjids, location, masjids]
  );

  const sortedMasjids: MasjidWithDistance[] = useMemo(() => {
    // Location-first rule: never show seeded Firestore/starter data as “nearby”
    // until the user has provided a real search center. Once a location is known,
    // every listing is filtered by radius and sorted by actual distance first.
    if (!location) return [];

    return allMasjids
      .map((masjid) => ({
        masjid,
        distance: displayDistanceKm(location, masjid) ?? distanceKm(location, masjid.coordinates)
      }))
      .filter(({ distance }) => distance <= 5)
      .sort((a, b) => {
        const distanceDelta = (a.distance ?? 999999) - (b.distance ?? 999999);
        if (Math.abs(distanceDelta) > 0.03) return distanceDelta;

        return listingQualityPenalty(a.masjid) - listingQualityPenalty(b.masjid);
      });
  }, [allMasjids, location]);

  const bestForJamaat = location ? rankMasjidsForJamaat(sortedMasjids.map(({ masjid, distance }) => ({ masjid, distance: distance ?? 0 })))[0] : undefined;
  const bestOption = sortedMasjids[0];
  const bestHasTimings = bestOption ? hasVerifiedTimings(bestOption.masjid) : false;
  const bestNext = bestOption && bestHasTimings ? getNextJamaat(bestOption.masjid) : undefined;
  const bestWalk = walkingMinutes(bestOption?.distance);
  const canReach = bestWalk !== undefined && bestNext !== undefined ? bestWalk <= bestNext.minutesUntil : undefined;
  const bestReach = bestOption ? evaluateJamaatReach(bestOption.masjid, bestOption.distance) : undefined;
  const bestName = bestOption ? displayMasjidName(bestOption.masjid) : undefined;
  const bestLocality = bestOption ? displayMasjidLocality(bestOption.masjid) : undefined;
  const bestNavigationAction = bestOption ? getMasjidNavigationAction(bestOption.masjid, location) : undefined;
  const moreOptions = bestOption
    ? sortedMasjids.filter(({ masjid }) => masjid.id !== bestOption.masjid.id).slice(0, 12)
    : [];

  return (
    <>
      <AppHeader />
      <main className="home-page safe-layout-page">
        <section className="hero-card home-command-hero">
          <p className="kicker">Location-first masjid finder</p>
          <h2 className="hero-title">Nearby masjids, distance, and Qibla — from your exact location.</h2>
          {bestOption && (
            <div className="hero-meta">
              <span className="pill">Nearest: {bestName}</span>
              <span className="pill">{formatDistance(bestOption.distance)}</span>
              {bestWalk && <span className="pill">{bestWalk} min walk</span>}
              {bestNext ? <span className="pill">{bestNext.displayName} {bestNext.time}</span> : <span className="pill">Timing not verified</span>}
              {bestForJamaat && bestForJamaat.masjid.id !== bestOption.masjid.id && <span className="pill">Best now: {displayMasjidName(bestForJamaat.masjid)}</span>}
            </div>
          )}
          <div className="cta-row premium-cta-row">
            <button className="button" type="button" onClick={requestLocation} disabled={isLocating || isDiscovering}>
              {isLocating ? "Locating…" : isDiscovering ? "Searching…" : "Find nearby"}
            </button>
            <Link className="secondary-button" href="/nearby">Search place</Link>
            <Link className="ghost-button" href="/qibla">Qibla</Link>
            <Link className="ghost-button" href="/missing">Missing masjid</Link>
          </div>
        </section>

        {source !== "demo" && <DataStatus source={source} message={message} isLoading={isLoading} />}

        <LocationStatus
          isLocating={isLocating}
          isSearchingNearby={isDiscovering}
          hasLocation={Boolean(location)}
          error={locationError}
          onLocate={requestLocation}
        />

        {discoveryMessage && <div className="provider-discovery-note home-discovery-note" role="status" aria-live="polite"><strong>Discovery:</strong><span>{discoveryMessage}</span></div>}
        {discoveryError && <div className="notice neutral compact">{discoveryError}</div>}

        {bestOption && (
          <section className="detail-hero" aria-label="Best nearby masjid option">
            <div className="detail-title">
              <div>
                <p className="kicker dark-kicker">Nearest to you</p>
                <h2>{bestName}</h2>
                <p>{bestLocality}</p>
              </div>
              <span className={`badge ${sourceClassName(bestOption.masjid)}`}>{displaySourceBadge(bestOption.masjid)}</span>
            </div>
            <div className="meta-grid">
              <div className="meta-item">
                <span>{bestNext ? "Next" : "Listing"}</span>
                <strong>{bestNext ? bestNext.displayName : "Masjid"}</strong>
              </div>
              <div className="meta-item">
                <span>{bestNext ? "Jamaat" : "Timings"}</span>
                <strong>{bestNext ? bestNext.time : "Verify"}</strong>
              </div>
              <div className="meta-item">
                <span>Reach?</span>
                <strong>{canReach === undefined ? "Navigate" : canReach ? "Yes" : "Tight"}</strong>
              </div>
            </div>
            <div className="notice neutral">
              {bestReach ? bestReach.detail : bestWalk
                ? `Estimated walking time is ${bestWalk} min. ${displayVerificationNotice(bestOption.masjid)}`
                : displayVerificationNotice(bestOption.masjid)}
            </div>
            <div className="card-actions">
              <Link className="ghost-button" href={`/masjid/${bestOption.masjid.id}`}>View masjid</Link>
              <a className="secondary-button" href={bestNavigationAction?.href} target="_blank" rel="noreferrer" title={bestNavigationAction?.helperText} data-trusted-route={bestNavigationAction?.trustedForDirectRoute ? "true" : "false"}>{bestNavigationAction?.label ?? "Open Maps"}</a>
            </div>
          </section>
        )}

        {bestOption && <AdSlot placement="home-after-nearest" />}

        <div className="section-head">
          <h2>{bestOption ? "More nearby masjids" : "Nearby masjids"}</h2>
          <Link href="/nearby">See all</Link>
        </div>

        <div className="masjid-list">
          {moreOptions.map(({ masjid, distance }, index) => (
            <MasjidCard key={masjid.id} masjid={masjid} distanceKm={distance} origin={location} rank={index + 2} />
          ))}
          {bestOption && moreOptions.length === 0 && (
            <section className="info-card empty-state">
              <h2>No duplicate card here</h2>
              <p>The nearest masjid is already shown above. Open Nearby to expand the search radius, search a place, or report a missing masjid.</p>
              <Link className="secondary-button" href="/missing">Report missing masjid</Link>
            </section>
          )}
          {!bestOption && !sortedMasjids.length && (
            <section className="info-card empty-state">
              <h2>{location ? "No nearby masjid found yet" : "Your location is needed first"}</h2>
              <p>{location ? "Open Nearby to expand the radius, search an exact masjid name, or report a missing pin." : "The app no longer shows starter Chennai listings by default. Tap Find nearby so results are based on the person’s location and every card can show distance."}</p>
              <div className="card-actions">
                <button className="ghost-button" type="button" onClick={requestLocation} disabled={isLocating || isDiscovering}>Find nearby</button>
                <Link className="secondary-button" href="/nearby">Search place</Link>
              </div>
            </section>
          )}
        </div>

        <section className="info-card launch-grid-card premium-actions-card">
          <h3>Quick actions</h3>
          <p>Find a masjid, check Qibla, save your regular masjids, or report a missing pin so the network improves.</p>
          <div className="quick-action-grid">
            <Link className="quick-action" href="/nearby"><strong>Nearby</strong><span>Distance-sorted</span></Link>
            <Link className="quick-action" href="/qibla"><strong>Qibla</strong><span>Bearing + compass</span></Link>
            <Link className="quick-action" href="/saved"><strong>Saved</strong><span>Follow masjids</span></Link>
            <Link className="quick-action" href="/missing"><strong>Missing</strong><span>Add exact pin</span></Link>
          </div>
        </section>

        <div className="footer-space" />
      </main>
    </>
  );
}
