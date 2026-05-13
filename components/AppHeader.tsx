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
      
    </header>
  );
}



