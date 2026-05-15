"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { useMasjids } from "@/hooks/useMasjids";
import { hasVerifiedTimings, isExternalDiscoveredListing } from "@/lib/verification";

export default function NetworkPage() {
  const { masjids, source, message, isLoading } = useMasjids();
  const verified = masjids.filter((masjid) => masjid.verificationStatus === "admin_verified");
  const community = masjids.filter((masjid) => masjid.verificationStatus === "community_checked");
  const timingReady = masjids.filter(hasVerifiedTimings);
  const external = masjids.filter(isExternalDiscoveredListing);
  const needsVerification = masjids.filter((masjid) => !hasVerifiedTimings(masjid));
  const claimedOrAssigned = masjids.filter((masjid) => masjid.assignedAdminIds?.length);

  const coverageScore = Math.min(100, Math.round(verified.length * 8 + community.length * 5 + timingReady.length * 4 + claimedOrAssigned.length * 7));

  return (
    <>
      <AppHeader />
      <main className="network-page safe-layout-page">
        <section className="hero-card network-hero">
          <p className="kicker">Trusted masjid network</p>
          <h2 className="hero-title">Let real masjid teams keep jamaat timings accurate.</h2>
          <p>
            Generic maps can show pins. Where’s My Masjid becomes useful when committee members, imams, muazzins,
            and authorised caretakers can claim their own masjid and keep timings fresh.
          </p>
          <div className="cta-row premium-cta-row">
            <Link className="button" href="/claim">Start masjid claim</Link>
            <Link className="secondary-button" href="/my-masjids">Masjid dashboard</Link>
            <Link className="ghost-button" href="/missing">Report missing masjid</Link>
            <Link className="ghost-button" href="/nearby">Find listing</Link>
          </div>
        </section>

        <DataStatus source={source} message={message} isLoading={isLoading} />

        <section className="info-card network-health-card">
          <div className="section-inline-head network-health-head">
            <div>
              <h3>Verified network health</h3>
              <p className="small-text">This is the part competitors cannot copy quickly: real jamaat data maintained by real masjid people.</p>
            </div>
            <strong className="network-score">{coverageScore}/100</strong>
          </div>
          <div className="trust-meter"><span style={{ width: `${coverageScore}%` }} /></div>
          <div className="meta-grid network-stat-grid">
            <div className="meta-item"><span>Admin verified</span><strong>{verified.length}</strong></div>
            <div className="meta-item"><span>Community checked</span><strong>{community.length}</strong></div>
            <div className="meta-item"><span>Jamaat ready</span><strong>{timingReady.length}</strong></div>
            <div className="meta-item"><span>Claimed / assigned</span><strong>{claimedOrAssigned.length}</strong></div>
          </div>
        </section>

        <section className="info-card claim-security-card">
          <h3>Masjid claim procedure</h3>
          <p className="small-text">A claim never gives instant edit access. It creates a private review request for the platform owner/admin, then the masjid representative is assigned only to their own masjid.</p>
          <div className="claim-process-grid">
            <article className="claim-step-card">
              <span>1</span>
              <strong>Submit claim</strong>
              <p>Masjid name, area, authorised contact, role, phone/email, and proof are submitted.</p>
            </article>
            <article className="claim-step-card">
              <span>2</span>
              <strong>Verify identity</strong>
              <p>Admin checks by phone call, masjid office confirmation, notice-board/timetable proof, or local verification.</p>
            </article>
            <article className="claim-step-card">
              <span>3</span>
              <strong>Assign access</strong>
              <p>After approval, the claimant’s Firebase Auth UID is assigned to only that masjid.</p>
            </article>
            <article className="claim-step-card">
              <span>4</span>
              <strong>Maintain timings</strong>
              <p>The masjid team uses the private dashboard to update jamaat, Jumu’ah, facilities, and announcements.</p>
            </article>
          </div>
        </section>


        <section className="info-card acquisition-machine-card">
          <h3>Acquisition-machine loop</h3>
          <p className="small-text">The app now has a safe path from public discovery to claimed masjid operations without exposing internal diagnostics.</p>
          <div className="machine-loop-grid">
            <article><strong>Find</strong><span>Users discover nearby masjids and missing timings.</span></article>
            <article><strong>Claim</strong><span>Authorised masjid representatives submit proof.</span></article>
            <article><strong>Approve</strong><span>Owner/admin verifies identity and assigns one masjid.</span></article>
            <article><strong>Operate</strong><span>Approved teams update jamaat, Jumu’ah, facilities, and announcements from /my-masjids.</span></article>
          </div>
        </section>

        <section className="info-stack network-grid">
          <article className="info-card">
            <h3>1. Discover</h3>
            <p>Mappls, Foursquare, Google Places, and OSM can discover candidate pins. They help find locations, but they are not trusted jamaat data yet.</p>
          </article>
          <article className="info-card">
            <h3>2. Verify</h3>
            <p>Admins or trusted volunteers confirm name, exact pin, facilities, and jamaat timings. Verified listings unlock reach-before-jamaat guidance.</p>
          </article>
          <article className="info-card">
            <h3>3. Claim</h3>
            <p>Masjid heads or authorised representatives claim their listing through the review process and maintain only their own masjid.</p>
          </article>
          <article className="info-card">
            <h3>4. Improve</h3>
            <p>Users report missing masjids and suggest corrections. Admins approve changes and the database becomes stronger in every locality.</p>
          </article>
        </section>

        <section className="info-card network-checklist-card">
          <h3>Launch checklist for each locality</h3>
          <div className="timing-grid network-check-grid">
            <div className="timing-cell"><span>Minimum verified masjids</span><strong>10+</strong></div>
            <div className="timing-cell"><span>Jamaat timings</span><strong>All 5 salah</strong></div>
            <div className="timing-cell"><span>Jumu’ah</span><strong>Listed</strong></div>
            <div className="timing-cell"><span>Claim owner</span><strong>Committee/admin</strong></div>
            <div className="timing-cell"><span>Freshness</span><strong>Checked monthly</strong></div>
          </div>
          <p className="small-text">Current listings needing verification: {needsVerification.length}. Convert external candidates into verified listings only after local confirmation, then encourage masjid heads to claim and maintain them.</p>
        </section>

        <div className="footer-space" />
      </main>
    </>
  );
}
