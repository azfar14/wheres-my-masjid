type LocationStatusProps = {
  isLocating: boolean;
  isSearchingNearby?: boolean;
  hasLocation: boolean;
  error?: string;
  onLocate: () => void;
};

export function LocationStatus({ isLocating, isSearchingNearby = false, hasLocation, error, onLocate }: LocationStatusProps) {
  const isBusy = isLocating || isSearchingNearby;
  const buttonText = isLocating
    ? "Locating…"
    : isSearchingNearby
      ? "Checking precision providers…"
      : hasLocation
        ? "Refresh nearby search"
        : "Use my location";

  return (
    <section className="status-card">
      <button className="ghost-button full" type="button" onClick={onLocate} disabled={isBusy}>
        {buttonText}
      </button>
      {hasLocation && !isSearchingNearby && <p>Nearby listings are sorted by distance. Precision search can be refreshed anytime.</p>}
      {hasLocation && isSearchingNearby && <p>Checking Mappls/Foursquare/OSM briefly. Saved and verified listings remain visible while this runs.</p>}
      {!hasLocation && !error && <p>Allow location to search masjids around you, or search any city/area worldwide. On phone, use an HTTPS deployed link for reliable location access.</p>}
      {error && <p>{error}</p>}
    </section>
  );
}
