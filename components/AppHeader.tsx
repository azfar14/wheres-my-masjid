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
      <nav className="flex items-center gap-2 flex-shrink-0">
          <Link 
            href="/nearby"
            className="header-chip px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-full whitespace-nowrap transition"
          >
            Nearby
          </Link>
          <Link 
            href="/qibla"
            className="header-chip px-4 py-2 text-sm font-medium bg-emerald-800 text-white rounded-full whitespace-nowrap transition"
          >
            Qibla
          </Link>
          <Link 
            href="/network"
            className="header-chip px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-full whitespace-nowrap transition"
          >
            Network
          </Link>
        </nav>
    </header>
  );
}



