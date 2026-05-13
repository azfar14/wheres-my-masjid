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

  const coverageScore = Math.min(100, Math.round(verified.length * 8 + community.length * 5 + timingReady.length * 4));

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card network-hero">
          <p className="kicker">300-crore moat</p>
          <h2 className="hero-title">Build the trusted masjid network, not just another map.</h2>
          <p>
            Google and map APIs can show pins. Where’s My Masjid becomes valuable when it owns verified jamaat timings,
            committee claims, correction history, facilities, and local trust.
          </p>
          <div className="cta-row premium-cta-row">
            <Link className="button" href="/missing">Report missing masjid</Link>
            <Link className="secondary-button" href="/claim">Claim a masjid</Link>
            <Link className="ghost-button" href="/admin">Admin</Link>
            <Link className="ghost-button" href="/qa">QA lab</Link>
          </div>
        </section>

        <DataStatus source={source} message={message} isLoading={isLoading} />

        <section className="info-card">
          <div className="section-inline-head">
            <div>
              <h3>Verified network health</h3>
              <p className="small-text">This is the part competitors cannot copy quickly: real jamaat data maintained by real masjid people.</p>
            </div>
            <strong className="network-score">{coverageScore}/100</strong>
          </div>
          <div className="trust-meter"><span style={{ width: `${coverageScore}%` }} /></div>
          <div className="meta-grid">
            <div className="meta-item"><span>Admin verified</span><strong>{verified.length}</strong></div>
            <div className="meta-item"><span>Community checked</span><strong>{community.length}</strong></div>
            <div className="meta-item"><span>Jamaat ready</span><strong>{timingReady.length}</strong></div>
            <div className="meta-item"><span>External pins</span><strong>{external.length}</strong></div>
          </div>
        </section>

        <section className="info-stack network-grid">
          <article className="info-card">
            <h3>1. Discover</h3>
            <p>Foursquare, Mappls, Google Places, and OSM can discover candidate pins. They are useful for navigation, but not trusted jamaat data yet.</p>
          </article>
          <article className="info-card">
            <h3>2. Verify</h3>
            <p>Admins or trusted volunteers confirm name, exact pin, facilities, and jamaat timings. Verified listings unlock reach-before-jamaat guidance.</p>
          </article>
          <article className="info-card">
            <h3>3. Claim</h3>
            <p>Masjid committees claim their listing and maintain timings. This turns the website into a live network, not a static directory.</p>
          </article>
          <article className="info-card">
            <h3>4. Improve</h3>
            <p>Users report missing masjids and suggest corrections. Admins approve changes and the database becomes stronger in every locality.</p>
          </article>
        </section>


        <div className="footer-space" />
      </main>
    </>
  );
}
