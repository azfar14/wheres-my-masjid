import Link from "next/link";

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="App navigation">
      <Link href="/nearby"><span>⌖</span><strong>Nearby</strong></Link>
      <Link href="/qibla"><span>🧭</span><strong>Qibla</strong></Link>
      <Link href="/saved"><span>★</span><strong>Saved</strong></Link>
      <Link href="/notifications"><span>🔔</span><strong>Alerts</strong></Link>
      <Link href="/missing"><span>＋</span><strong>Missing</strong></Link>
    </nav>
  );
}
