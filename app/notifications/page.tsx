"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { notificationSupportMessage, requestFirebaseNotifications } from "@/lib/notificationService";

export default function NotificationsPage() {
  const [status, setStatus] = useState<string>(() => typeof window === "undefined" ? "Checking…" : notificationSupportMessage());
  const [isBusy, setIsBusy] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | undefined>();

  async function enable() {
    setIsBusy(true);
    const result = await requestFirebaseNotifications();
    setStatus(result.message);
    setTokenPreview(result.token ? `${result.token.slice(0, 12)}…${result.token.slice(-8)}` : undefined);
    setIsBusy(false);
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card notification-hero">
          <p className="kicker">Smart reminders</p>
          <h2 className="hero-title">Get jamaat, Jumu’ah, and saved-masjid update alerts.</h2>
          <div className="hero-meta">
            <span className="pill">FCM ready when configured</span>
            <span className="pill">Requires HTTPS</span>
            <span className="pill">User opt-in only</span>
          </div>
          <div className="cta-row">
            <button className="button" type="button" onClick={enable} disabled={isBusy}>{isBusy ? "Enabling…" : "Enable alerts"}</button>
            <Link className="secondary-button" href="/saved">Saved masjids</Link>
            <Link className="ghost-button" href="/claim">Claim masjid</Link>
          </div>
        </section>

        <section className="info-card">
          <h3>Notification status</h3>
          <div className={status.includes("enabled") || status === "Ready" ? "notice success compact" : "notice neutral compact"}>{status}</div>
          {tokenPreview && <p className="small-text">Saved token: {tokenPreview}</p>}
          <p className="small-text">This page stores the user’s Firebase Cloud Messaging token in Firestore. Sending scheduled notifications later requires Firebase Cloud Functions or another trusted server using the Firebase Admin SDK.</p>
        </section>

        <section className="info-card">
          <h3>Recommended alert types</h3>
          <div className="feature-list-grid">
            <div className="feature-chip">Leave now to reach jamaat</div>
            <div className="feature-chip">Jumu’ah reminder</div>
            <div className="feature-chip">Saved masjid timing changed</div>
            <div className="feature-chip">Ramadan timetable update</div>
          </div>
        </section>
        <div className="footer-space" />
      </main>
    </>
  );
}
