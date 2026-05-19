"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { AdSlot } from "@/components/AdSlot";
import { useMasjid } from "@/hooks/useMasjids";
import { listMasjidAnnouncements } from "@/lib/masjidService";
import { displayDistanceKm, exactMapUrlForMasjid, formatDistance, openStreetMapObjectUrl, walkingMinutes, distanceKm } from "@/lib/geo";
import { getMasjidNavigationAction } from "@/lib/navigationTrust";
import { formatCountdown, getNextJamaat, salahDisplayNames, salahOrder } from "@/lib/jamaat";
import { reachabilityAdvice } from "@/lib/reachability";
import { isSavedMasjid, toggleSavedMasjid } from "@/lib/savedMasjids";
import { calculateTrustScore } from "@/lib/trustScore";
import { readRememberedLocation } from "@/lib/locationMemory";
import { displayMasjidLocality, displayMasjidName, displaySourceBadge, displayTrustLabel, displayVerificationNotice, sourceClassName } from "@/lib/masjidDisplay";
import type { Coordinates, MasjidAnnouncement } from "@/types";
import {
  hasVerifiedTimings,
  isExternalDiscoveredListing,
  isLowConfidenceListing,
  isOpenStreetMapListing
} from "@/lib/verification";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function MasjidDetailPage() {
  const params = useParams<{ id: string }>();
  const id = firstParam(params?.id);
  const { masjid, source, message, isLoading } = useMasjid(id);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState<Coordinates | undefined>();
  const [originLabel, setOriginLabel] = useState<string | undefined>();
  const [announcements, setAnnouncements] = useState<MasjidAnnouncement[]>([]);

  useEffect(() => {
    if (masjid) setSaved(isSavedMasjid(masjid.id));
    const remembered = readRememberedLocation();
    if (remembered) {
      setOrigin(remembered.coordinates);
      setOriginLabel(remembered.label ?? "saved location");
    }
  }, [masjid]);

  useEffect(() => {
    let cancelled = false;
    async function loadAnnouncements() {
      if (!masjid) {
        setAnnouncements([]);
        return;
      }
      try {
        const nextAnnouncements = await listMasjidAnnouncements(masjid.id);
        if (!cancelled) setAnnouncements(nextAnnouncements);
      } catch {
        if (!cancelled) setAnnouncements([]);
      }
    }

    void loadAnnouncements();
    return () => { cancelled = true; };
  }, [masjid]);

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <main>
          <div className="notice neutral">Loading masjid profile…</div>
        </main>
      </>
    );
  }

  if (!masjid) {
    return (
      <>
        <AppHeader />
        <main>
          <section className="info-card empty-state">
            <h2>Masjid not found</h2>
            <p>This listing may not exist yet, or it may have come from a previous nearby search that is no longer saved on this device.</p>
            <Link className="ghost-button full" href="/nearby">Back to nearby list</Link>
          </section>
        </main>
      </>
    );
  }

  const timingsAreVerified = hasVerifiedTimings(masjid);
  const next = timingsAreVerified ? getNextJamaat(masjid) : undefined;
  const isOsm = isOpenStreetMapListing(masjid);
  const isExternal = isExternalDiscoveredListing(masjid);
  const lowConfidence = isLowConfidenceListing(masjid);
  const trust = calculateTrustScore(masjid);
  const displayName = displayMasjidName(masjid);
  const displayLocality = displayMasjidLocality(masjid);
  const distanceFromOrigin = origin ? (displayDistanceKm(origin, masjid) ?? distanceKm(origin, masjid.coordinates)) : undefined;
  const walkFromOrigin = walkingMinutes(distanceFromOrigin);
  const navigationAction = getMasjidNavigationAction(masjid, origin);

  return (
    <>
      <AppHeader />
      <main>
        <DataStatus source={source} message={message} />

        <section className={lowConfidence ? "detail-hero low-confidence" : "detail-hero"}>
          <div className="detail-title">
            <div>
              <p className="kicker dark-kicker">Masjid profile</p>
              <h2>{displayName}</h2>
              <p>{displayLocality}</p>
            </div>
            <span className={`badge ${sourceClassName(masjid)}`}>{displaySourceBadge(masjid)}</span>
          </div>

          <div className="meta-grid">
            <div className="meta-item">
              <span>{next ? "Next" : "Listing"}</span>
              <strong>{next ? next.displayName : "Masjid"}</strong>
            </div>
            <div className="meta-item">
              <span>{next ? "Jamaat" : "Distance"}</span>
              <strong>{next ? next.time : formatDistance(distanceFromOrigin)}</strong>
            </div>
            <div className="meta-item">
              <span>{next ? "Starts" : "Walk"}</span>
              <strong>{next ? formatCountdown(next.minutesUntil) : walkFromOrigin ? `${walkFromOrigin} min` : "Navigate"}</strong>
            </div>
          </div>

          <div className={lowConfidence ? "notice danger-soft" : "notice neutral"}>
            {displayVerificationNotice(masjid)}
          </div>

          {timingsAreVerified && <div className="notice compact success">{reachabilityAdvice(masjid, distanceFromOrigin)}{originLabel ? ` From ${originLabel}.` : ""}</div>}

          <div className={`navigation-safety-strip ${navigationAction.badgeTone}`}>
            <strong>{navigationAction.badgeLabel}</strong>
            <span>{navigationAction.helperText}</span>
          </div>

          {isExternal && (
            <div className="notice compact neutral">
              This is an external discovery listing. The app blocks raw one-tap coordinate navigation until the pin is route-tested. Confirm the real mosque in Google Maps, then submit the exact pin so admins can make it navigation-ready.
            </div>
          )}

          <div className="card-actions three-actions">
            <a className="button" href={navigationAction.href} target="_blank" rel="noreferrer" title={navigationAction.helperText} data-trusted-route={navigationAction.trustedForDirectRoute ? "true" : "false"}>{navigationAction.label}</a>
            <button className="secondary-button" type="button" onClick={() => setSaved(toggleSavedMasjid(masjid).saved)}>{saved ? "Saved" : "Save"}</button>
            <Link className="ghost-button" href={`/suggest/${masjid.id}`}>Suggest</Link>
          </div>

          <div className="card-actions three-actions utility-actions">
            <Link className="ghost-button" href={`/claim/${masjid.id}`}>Claim this masjid</Link>
            <Link className="ghost-button" href={`/qibla?lat=${masjid.coordinates.lat}&lng=${masjid.coordinates.lng}&label=${encodeURIComponent(displayName)}`}>Qibla</Link>
            {isOsm ? <a className="ghost-button" href={openStreetMapObjectUrl(masjid)} target="_blank" rel="noreferrer">OSM raw pin</a> : <a className="ghost-button" href={exactMapUrlForMasjid(masjid)} target="_blank" rel="noreferrer">Maps check</a>}
          </div>
          <Link className="ghost-button full compact-button" href="/my-masjids">Already approved? Open masjid dashboard</Link>
        </section>

        <div className="info-stack">
          <section className="info-card">
            <h3>Trust score</h3>
            <div className="trust-meter"><span style={{ width: `${trust.score}%` }} /></div>
            <p><strong>{displayTrustLabel(masjid)} · {trust.score}/100</strong></p>
            <p>{trust.reasons.length ? trust.reasons.join(" · ") : "Needs more verified information."}</p>
          </section>

          <section className="info-card">
            <h3>Distance and reach</h3>
            <div className="meta-grid">
              <div className="meta-item"><span>Distance</span><strong>{formatDistance(distanceFromOrigin)}</strong></div>
              <div className="meta-item"><span>Walk</span><strong>{walkFromOrigin ? `${walkFromOrigin} min` : "—"}</strong></div>
              <div className="meta-item"><span>Action</span><strong>{timingsAreVerified ? reachabilityAdvice(masjid, distanceFromOrigin).split("—")[0] : "Verify timing"}</strong></div>
            </div>
            {!origin && <p>Open Nearby first or use Qibla/Nearby location so this profile can show distance from you.</p>}
          </section>

          <AdSlot placement="masjid-profile" />

          {announcements.length > 0 && (
            <section className="info-card announcement-list-card">
              <h3>Masjid announcements</h3>
              <div className="announcement-list">
                {announcements.slice(0, 4).map((announcement) => (
                  <article className={`announcement-card ${announcement.priority}`} key={announcement.id}>
                    <span>{announcement.priority}</span>
                    <strong>{announcement.title}</strong>
                    <p>{announcement.message}</p>
                    {announcement.expiresAt && <small>Visible until {announcement.expiresAt}</small>}
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="info-card">
            <h3>Today’s jamaat timings</h3>
            {timingsAreVerified ? (
              <div className="timing-grid">
                {salahOrder.map((salah) => (
                  <div className="timing-cell" key={salah}>
                    <span>{salahDisplayNames[salah]}</span>
                    <strong>{masjid.jamaat[salah]}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="notice compact neutral">
                Jamaat timings are not verified for this listing yet. A local user or masjid admin should submit Fajr, Dhuhr, Asr, Maghrib, Isha, and Jumu’ah times.
              </div>
            )}
          </section>

          <section className="info-card">
            <h3>Jumu’ah</h3>
            <p>{timingsAreVerified && masjid.jumuah.length ? masjid.jumuah.join(" / ") : "Not verified yet"}</p>
          </section>

          <section className="info-card">
            <h3>Facilities</h3>
            {masjid.facilities.length ? (
              <div className="chips">
                {masjid.facilities.map((facility) => <span className="chip" key={facility}>{facility}</span>)}
              </div>
            ) : <p>Not added yet</p>}
          </section>

          <section className="info-card">
            <h3>Khutbah language</h3>
            {masjid.khutbahLanguages.length ? (
              <div className="chips">
                {masjid.khutbahLanguages.map((language) => <span className="chip" key={language}>{language}</span>)}
              </div>
            ) : <p>Not added yet</p>}
          </section>

          <section className="info-card">
            <h3>Address</h3>
            <p>{masjid.address}</p>
            {masjid.phone && <p>Phone: {masjid.phone}</p>}
            <p>Last checked: {masjid.lastVerifiedAt}</p>
            {masjid.osm && <p>OpenStreetMap ID: {masjid.osm.type}/{masjid.osm.id}</p>}
            {masjid.discoveryQuality && <p>Discovery confidence: {masjid.discoveryQuality}</p>}
            {masjid.notes && <p>{masjid.notes}</p>}
          </section>
        </div>

        <div className="footer-space" />
      </main>
    </>
  );
}
