import Link from "next/link";

export function AppHeader() {
  return (
    <header className="app-header polished-header">
      <Link className="brand" href="/" aria-label="Where’s My Masjid home">
        <span className="brand-mark" aria-hidden="true">☪</span>
        <span>
          <h1>Where’s My Masjid</h1>
          <p>Find jamaat near you</p>
        </span>
      </Link>
      <nav className="header-actions clean-header-actions" aria-label="Main shortcuts">
        <Link className="header-chip" href="/nearby">Nearby</Link>
        <Link className="header-chip" href="/qibla">Qibla</Link>
        <Link className="header-chip" href="/network">Network</Link>
      </nav>
    </header>
  );
}
