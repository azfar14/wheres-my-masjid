import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export default function NotFoundPage() {
  return (
    <>
      <AppHeader />
      <main>
        <section className="info-card empty-state">
          <p className="kicker">Page not found</p>
          <h1>This page does not exist.</h1>
          <p>Continue with nearby masjid search, Qibla, saved masjids, or admin tools.</p>
          <div className="card-actions three-actions">
            <Link className="secondary-button" href="/nearby">Find nearby</Link>
            <Link className="ghost-button" href="/qibla">Qibla</Link>
            <Link className="ghost-button" href="/">Home</Link>
          </div>
        </section>
      </main>
    </>
  );
}
