import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function OfflinePage() {
  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card">
          <p className="kicker">Offline mode</p>
          <h2 className="hero-title">You appear to be offline.</h2>
          <p className="small-text">Saved pages and saved masjids may still work. Live discovery, Firebase updates, and new reports need internet.</p>
          <div className="card-actions">
            <Link className="secondary-button" href="/nearby">Nearby</Link>
            <Link className="ghost-button" href="/qibla">Qibla</Link>
          </div>
        </section>
      </main>
    </>
  );
}
