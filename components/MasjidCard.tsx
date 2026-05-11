"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Coordinates, Masjid } from "@/types";
import { exactMapUrlForMasjid, formatDistance, walkingMinutes } from "@/lib/geo";
import { getMasjidNavigationAction } from "@/lib/navigationTrust";
import { formatCountdown, getNextJamaat } from "@/lib/jamaat";
import { reachabilityAdvice } from "@/lib/reachability";
import { evaluateJamaatReach } from "@/lib/smartRanking";
import { isSavedMasjid, toggleSavedMasjid } from "@/lib/savedMasjids";
import {
  displayMasjidLocality,
  displayMasjidName,
  displaySourceBadge,
  displayTimingLabel,
  displayTrustLabel,
  displayVerificationNotice,
  hasRealPublicName,
  sourceClassName
} from "@/lib/masjidDisplay";
import {
  hasVerifiedTimings,
  isExternalDiscoveredListing,
  isLowConfidenceListing,
  isOpenStreetMapListing
} from "@/lib/verification";

type MasjidCardProps = {
  masjid: Masjid;
  distanceKm?: number;
  origin?: Coordinates;
  rank?: number;
};

export function MasjidCard({ masjid, distanceKm, origin, rank }: MasjidCardProps) {
  const next = getNextJamaat(masjid);
  const walkMins = walkingMinutes(distanceKm);
  const timingsAreVerified = hasVerifiedTimings(masjid);
  const isOsm = isOpenStreetMapListing(masjid);
  const isExternal = isExternalDiscoveredListing(masjid);
  const lowConfidence = isLowConfidenceListing(masjid);
  const advice = reachabilityAdvice(masjid, distanceKm);
  const reachDecision = evaluateJamaatReach(masjid, distanceKm);
  const [saved, setSaved] = useState(false);
  const name = displayMasjidName(masjid);
  const locality = displayMasjidLocality(masjid);
  const sourceBadge = displaySourceBadge(masjid);
  const trustLabel = displayTrustLabel(masjid);
  const timingLabel = displayTimingLabel(masjid);
  const hasPublicName = hasRealPublicName(masjid);
  const navigationAction = getMasjidNavigationAction(masjid, origin);

  useEffect(() => {
    setSaved(isSavedMasjid(masjid.id));
  }, [masjid.id]);

  return (
    <article className={lowConfidence ? "masjid-card low-confidence" : "masjid-card"}>
      <div className="masjid-top">
        <div>
          <div className="card-title-line">
            {rank !== undefined && <span className="rank-pill">#{rank}</span>}
            <h3>{name}</h3>
          </div>
          <p className="locality">{locality}</p>
          <div className="badge-row">
            <span className={`mini-badge ${sourceClassName(masjid)}`}>{sourceBadge}</span>
            <span className="mini-badge clean-trust-badge">{trustLabel}</span>
          </div>
        </div>
        <div className={timingsAreVerified ? "next-badge" : "next-badge muted"} title={timingsAreVerified ? `${next.displayName} jamaat ${next.time}` : "Jamaat timings need verification"}>
          <strong>{timingsAreVerified ? next.time : "—"}</strong>
          <span>{timingsAreVerified ? next.displayName : "Timing"}</span>
        </div>
      </div>

      <div className="meta-grid">
        <div className="meta-item">
          <span>Distance</span>
          <strong>{formatDistance(distanceKm)}</strong>
        </div>
        <div className="meta-item">
          <span>Walk</span>
          <strong>{walkMins ? `${walkMins} min` : "—"}</strong>
        </div>
        <div className="meta-item">
          <span>{timingsAreVerified ? "Starts" : "Timings"}</span>
          <strong>{timingsAreVerified ? formatCountdown(next.minutesUntil) : "Verify"}</strong>
        </div>
      </div>

      <p className="source-line clean-source-line">{timingsAreVerified ? advice : `${timingLabel} · ${displayVerificationNotice(masjid)}`}</p>

      <div className={`reach-now-strip ${reachDecision.mode}`}>
        <strong>{reachDecision.headline}</strong>
        <span>{reachDecision.detail}</span>
      </div>

      <div className={`navigation-safety-strip ${navigationAction.badgeTone}`}>
        <strong>{navigationAction.badgeLabel}</strong>
        <span>{navigationAction.trustedForDirectRoute ? "Google Maps will open a route-ready destination." : "The raw provider pin is blocked; confirm the real mosque listing in Google Maps first."}</span>
      </div>

      {timingsAreVerified ? (
        <>
          <div className="timing-grid" aria-label="Today’s jamaat timings">
            <div className="timing-cell"><span>Fajr</span><strong>{masjid.jamaat.fajr}</strong></div>
            <div className="timing-cell"><span>Dhuhr</span><strong>{masjid.jamaat.dhuhr}</strong></div>
            <div className="timing-cell"><span>Asr</span><strong>{masjid.jamaat.asr}</strong></div>
            <div className="timing-cell"><span>Magh</span><strong>{masjid.jamaat.maghrib}</strong></div>
            <div className="timing-cell"><span>Isha</span><strong>{masjid.jamaat.isha}</strong></div>
          </div>
          <div className="notice compact success reach-advice">{advice}</div>
        </>
      ) : (
        <div className={lowConfidence ? "notice compact danger-soft" : "notice compact neutral"}>
          {hasPublicName ? "Location discovered. " : "Exact public name needed. "}
          Open Google Maps to verify the real mosque listing, then suggest the exact pin/name and jamaat timings so this becomes trusted.
        </div>
      )}

      <div className="card-actions three-actions">
        <Link className="ghost-button" href={`/masjid/${masjid.id}`}>Details</Link>
        <a className="secondary-button" href={navigationAction.href} target="_blank" rel="noreferrer" title={navigationAction.helperText} data-trusted-route={navigationAction.trustedForDirectRoute ? "true" : "false"}>
          {navigationAction.label}
        </a>
        {isExternal ? (
          <a className="ghost-button" href={exactMapUrlForMasjid(masjid)} target="_blank" rel="noreferrer" title="Open Google Maps search to confirm the real mosque before navigating">
            Maps check
          </a>
        ) : (
          <button className="ghost-button" type="button" onClick={() => setSaved(toggleSavedMasjid(masjid).saved)}>
            {saved ? "Saved" : "Save"}
          </button>
        )}
      </div>

      <div className="card-actions two-actions compact-card-actions">
        <Link className="ghost-button" href={`/suggest/${masjid.id}`}>Suggest timing/name</Link>
        <button className="ghost-button" type="button" onClick={() => setSaved(toggleSavedMasjid(masjid).saved)}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}
