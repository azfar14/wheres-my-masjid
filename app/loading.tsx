export default function Loading() {
  return (
    <main className="loading-shell">
      <section className="info-card loading-card">
        <div className="loading-pulse" />
        <h2>Preparing nearby masjid search…</h2>
        <p>Distance, provider layers, and verification status are being checked.</p>
      </section>
    </main>
  );
}
