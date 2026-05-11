"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MasjidCard } from "@/components/MasjidCard";
import { AdSlot } from "@/components/AdSlot";
import { useMasjids } from "@/hooks/useMasjids";
import { displayDistanceKm, distanceKm } from "@/lib/geo";
import { readSavedMasjids } from "@/lib/savedMasjids";
import { mergeMasjidSources } from "@/lib/osmMasjidService";
import type { Coordinates, Masjid } from "@/types";

export default function SavedMasjidsPage() {
  const { masjids } = useMasjids();
  const [savedSnapshots, setSavedSnapshots] = useState<Masjid[]>([]);
  const [location, setLocation] = useState<Coordinates | undefined>();
  const [locationError, setLocationError] = useState<string | undefined>();

  function refreshSaved() {
    setSavedSnapshots(readSavedMasjids());
  }

  useEffect(() => {
    refreshSaved();
    window.addEventListener("wmm:saved-masjids-changed", refreshSaved);
    return () => window.removeEventListener("wmm:saved-masjids-changed", refreshSaved);
  }, []);

  function requestLocation() {
    setLocationError(undefined);
    if (!("geolocation" in navigator)) {
      setLocationError("Your browser does not support location access.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setLocationError("Location permission was not granted."),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
  }

  const saved = useMemo(() => {
    const all = mergeMasjidSources(masjids, savedSnapshots, location);
    const savedIds = new Set(savedSnapshots.map((masjid) => masjid.id));
    return all
      .filter((masjid) => savedIds.has(masjid.id))
      .map((masjid) => ({ masjid, distance: location ? (displayDistanceKm(location, masjid) ?? distanceKm(location, masjid.coordinates)) : undefined }))
      .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER));
  }, [location, masjids, savedSnapshots]);

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card">
          <p className="kicker">Saved masjids</p>
          <h2 className="hero-title">Your regular prayer places.</h2>
          <div className="hero-meta">
            <span className="pill">{saved.length} saved</span>
            <span className="pill">Works offline with local snapshots</span>
          </div>
          <div className="cta-row">
            <button className="button" type="button" onClick={requestLocation}>Use location</button>
            <Link className="secondary-button" href="/nearby">Find more</Link>
          </div>
        </section>

        {locationError && <div className="notice danger compact">{locationError}</div>}

        <AdSlot placement="saved-feed" compact />

        <div className="masjid-list">
          {saved.map(({ masjid, distance }) => (
            <MasjidCard key={masjid.id} masjid={masjid} distanceKm={distance} origin={location} />
          ))}
          {!saved.length && (
            <section className="info-card empty-state">
              <h2>No saved masjids yet</h2>
              <p>Open a nearby result and tap Save. Saved masjids stay available as local snapshots even when internet is weak.</p>
              <Link className="button full" href="/nearby">Find nearby masjids</Link>
            </section>
          )}
        </div>
        <div className="footer-space" />
      </main>
    </>
  );
}
