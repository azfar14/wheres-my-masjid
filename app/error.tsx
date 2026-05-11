"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Where's My Masjid page error", error);
  }, [error]);

  return (
    <main className="error-shell">
      <section className="info-card empty-state">
        <p className="kicker">Recovery mode</p>
        <h1>Something did not load perfectly.</h1>
        <p>The app protected the user from a blank crash. Refresh the page, or go back to Nearby/Qibla.</p>
        <div className="card-actions three-actions">
          <button className="secondary-button" type="button" onClick={reset}>Try again</button>
          <Link className="ghost-button" href="/nearby">Nearby</Link>
          <Link className="ghost-button" href="/qibla">Qibla</Link>
        </div>
      </section>
    </main>
  );
}
