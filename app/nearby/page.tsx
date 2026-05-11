"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { LocationStatus } from "@/components/LocationStatus";
import { MasjidCard } from "@/components/MasjidCard";
import { AdSlot } from "@/components/AdSlot";
import { useMasjids } from "@/hooks/useMasjids";
import { saveDiscoveredMasjids } from "@/lib/discoveredMasjidStorage";
import { displayDistanceKm, distanceKm, googleMapsNearbyMasjidSearchUrl, openStreetMapNearbySearchUrl } from "@/lib/geo";
import { isBrowserSecureContext, locationProblemMessage } from "@/lib/browserSupport";
import { accuracyText, accuracyWarning, getBestBrowserLocation } from "@/lib/locationAccess";
import { discoverPrecisionMasjids, type PrecisionProviderResult } from "@/lib/precisionDiscovery";
import { mergeMasjidSources } from "@/lib/osmMasjidService";
import { importOpenStreetMapObject } from "@/lib/osmObjectImport";
import { searchPlaces, type PlaceSearchResult } from "@/lib/placeSearchService";
import { searchAreaMasjids } from "@/lib/areaMasjidService";
import { getSavedMasjidIds } from "@/lib/savedMasjids";
import { readRememberedLocation, rememberLocation } from "@/lib/locationMemory";
import { hasVerifiedTimings, isLowConfidenceListing } from "@/lib/verification";
import { nearestRank, rankMasjidsForJamaat } from "@/lib/smartRanking";
import { hasFacility, searchableMasjidText } from "@/lib/masjidDisplay";
import { providerHealthGridKey } from "@/lib/providerHealthGridKey";
import { isDirectNavigationReady } from "@/lib/navigationTrust";
import type { Coordinates, Masjid } from "@/types";

const radiusOptions = [1, 2, 5, 10, 25, 50, 100, 150];

function placeLooksLikeMasjid(place: PlaceSearchResult, originalQuery: string): boolean {
  const category = (place.category ?? "").toLowerCase();
  const roadOrArea = /highway|boundary|route|place \/ (neighbourhood|suburb|quarter|city|town|village)/.test(category);
  const worshipCategory = /amenity \/ place_of_worship|building \/ mosque|type \/ mosque/.test(category);
  if (roadOrArea && !worshipCategory) return false;

  const text = `${place.name} ${place.displayName} ${place.category ?? ""} ${originalQuery}`.toLowerCase();
  return /masjid|mosque|musalla|musholla|pallivasal|islamic|place_of_worship/.test(text);
}


type SearchReport = {
  radiusKm: number;
  finalCount: number;
  providerBreakdown: string;
  qaHref: string;
  noResultReason?: string;
};

function masjidFromPlaceResult(place: PlaceSearchResult): Masjid {
  return {
    id: place.osm ? `osm-${place.osm.type}-${place.osm.id}` : `osm-search-${place.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`,
    name: place.name,
    locality: place.displayName.split(",").slice(1, 3).join(",").trim() || "Selected area",
    address: place.displayName,
    coordinates: place.coordinates,
    phone: undefined,
    facilities: [],
    khutbahLanguages: [],
    verificationStatus: "osm_discovered",
    lastVerifiedAt: "OpenStreetMap search",
    jamaat: { fajr: "05:10", dhuhr: "13:30", asr: "17:15", maghrib: "18:45", isha: "20:15" },
    jumuah: [],
    source: "openstreetmap",
    osm: place.osm,
    osmConfidence: "named",
    discoveryQuality: "medium",
    notes: "Found by exact OpenStreetMap place search. Verify the pin and jamaat timings before showing countdowns."
  };
}

export default function NearbyPage() {
  const { masjids, source, message, isLoading } = useMasjids();
  const [location, setLocation] = useState<Coordinates | undefined>();
  const [locationLabel, setLocationLabel] = useState<string | undefined>();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | undefined>();
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [rememberedLabel, setRememberedLabel] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeError, setPlaceError] = useState<string | undefined>();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hasTimingsOnly, setHasTimingsOnly] = useState(false);
  const [jumuahOnly, setJumuahOnly] = useState(false);
  const [womenFriendlyOnly, setWomenFriendlyOnly] = useState(false);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState(5);
  const [sortMode, setSortMode] = useState<"nearest" | "jamaat">("nearest");
  const [directRouteOnly, setDirectRouteOnly] = useState(false);
  const [discoveredMasjids, setDiscoveredMasjids] = useState<Masjid[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | undefined>();
  const [discoveryError, setDiscoveryError] = useState<string | undefined>();
  const [providerStatus, setProviderStatus] = useState<string | undefined>();
  const [providerResults, setProviderResults] = useState<PrecisionProviderResult[]>([]);
  const [searchReport, setSearchReport] = useState<SearchReport | undefined>();
  const [osmImportText, setOsmImportText] = useState("");
  const [osmImportStatus, setOsmImportStatus] = useState<string | undefined>();
  const [osmImportError, setOsmImportError] = useState<string | undefined>();

  useEffect(() => {
    const refreshSavedIds = () => setSavedIds(getSavedMasjidIds());
    refreshSavedIds();
    const remembered = readRememberedLocation();
    if (remembered) setRememberedLabel(remembered.label ?? `${remembered.coordinates.lat.toFixed(4)}, ${remembered.coordinates.lng.toFixed(4)}`);
    window.addEventListener("wmm:saved-masjids-changed", refreshSavedIds);
    return () => window.removeEventListener("wmm:saved-masjids-changed", refreshSavedIds);
  }, []);

  async function discoverNearby(coords: Coordinates, radius = radiusKm, label?: string) {
    setIsDiscovering(true);
    setDiscoveryError(undefined);
    setDiscoveryMessage(undefined);
    setProviderStatus(undefined);

    try {
      // Strict location-first rule:
      // Never silently expand the user’s chosen radius. If we auto-expand, users
      // see far-away masjids and think the app used the wrong location. Instead,
      // show only results inside the selected radius and let the user expand
      // manually from the radius dropdown.
      const result = await discoverPrecisionMasjids(coords, radius);
      const inRadius = result.masjids.filter((masjid) => (displayDistanceKm(coords, masjid) ?? distanceKm(coords, masjid.coordinates)) <= radius);
      const sortedInRadius = mergeMasjidSources([], inRadius, coords)
        .filter((masjid) => (displayDistanceKm(coords, masjid) ?? distanceKm(coords, masjid.coordinates)) <= radius)
        .sort((a, b) => (displayDistanceKm(coords, a) ?? distanceKm(coords, a.coordinates)) - (displayDistanceKm(coords, b) ?? distanceKm(coords, b.coordinates)));

      setDiscoveredMasjids(sortedInRadius);
      setProviderResults(result.providerResults);
      saveDiscoveredMasjids(sortedInRadius);

      const providerText = result.providerResults
        .map((item) => `${item.label}: ${item.enabled ? item.count : "off"}${item.cached ? " cached" : ""}`)
        .join(" · ");
      setProviderStatus(providerText);
      setSearchReport({
        radiusKm: radius,
        finalCount: sortedInRadius.length,
        providerBreakdown: providerText || "No external providers answered.",
        qaHref: `/qa?lat=${coords.lat.toFixed(6)}&lng=${coords.lng.toFixed(6)}&radiusKm=${radius}`,
        noResultReason: sortedInRadius.length
          ? undefined
          : "No accepted masjid was found inside the selected radius. Expand the radius manually, check QA, or report the exact pin. The app no longer shows far-away results as nearby."
      });

      setDiscoveryMessage(
        sortedInRadius.length
          ? `Found ${sortedInRadius.length} nearby listing${sortedInRadius.length === 1 ? "" : "s"} within ${radius} km, sorted from nearest to farthest.${label ? ` Search center: ${label}.` : ""}`
          : `No nearby masjid found within ${radius} km.${label ? ` Search center: ${label}.` : ""} Try 10 km/25 km, open Google Maps search, or report a missing masjid.`
      );

      if (result.errors.length) {
        setDiscoveryError(`Some provider layers failed, but the strict nearby filter still ran: ${result.errors.slice(0, 3).join(" · ")}`);
      } else if (result.diagnostics.length) {
        setDiscoveryError(`Provider diagnostics: ${result.diagnostics.slice(0, 8).join(" · ")}`);
      }
      return sortedInRadius;
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : "Precision search could not finish. Showing saved/verified listings.");
      return [];
    } finally {
      setIsDiscovering(false);
    }
  }

  async function requestLocation() {
    setLocationError(undefined);
    setPlaceError(undefined);

    if (!("geolocation" in navigator)) {
      setLocationError(locationProblemMessage().message);
      return;
    }

    if (!isBrowserSecureContext()) {
      setLocationError("This phone URL is not HTTPS, so the browser may block location. Trying once anyway; deploy to HTTPS for reliable phone testing.");
    }

    setIsLocating(true);
    try {
      const result = await getBestBrowserLocation();
      const coords = result.coordinates;
      setLocation(coords);
      setManualLat(String(Number(coords.lat.toFixed(6))));
      setManualLng(String(Number(coords.lng.toFixed(6))));
      setLocationLabel("your current location");
      rememberLocation(coords, "your current location");
      setRememberedLabel("your current location");
      setLocationError([accuracyText(result), accuracyWarning(result)].filter(Boolean).join(" — "));
      void discoverNearby(coords, radiusKm, "your current location");
    } catch (error) {
      setLocationError(locationProblemMessage(error as GeolocationPositionError).message);
    } finally {
      setIsLocating(false);
    }
  }

  async function searchPlaceAndDiscover() {
    setPlaceError(undefined);
    setLocationError(undefined);
    setDiscoveryError(undefined);

    const text = placeQuery.trim();
    const looksLikeMasjidFilter = /masjid|mosque|musalla|musholla|pallivasal|eidgah|jumma|jamia/i.test(text);

    // If the user already gave their location and types “masjid/mosque”, treat it
    // as a nearby filter/search term instead of moving the search center to the
    // first geocoded place somewhere else. This prevents the “far-away masjid”
    // problem after searching.
    if (location && looksLikeMasjidFilter) {
      setQuery(text);
      setPlaceResults([]);
      setPlaceError(`Filtering masjids around ${locationLabel ?? "your current location"}. To search another city/area, type only the area name, for example “Triplicane” or “Makkah”.`);
      await discoverNearby(location, radiusKm, locationLabel ?? "your current location");
      return;
    }

    setIsSearchingPlace(true);
    try {
      const results = await searchPlaces(text);
      setPlaceResults(results);
      setQuery("");
      const first = results[0];
      if (!first) {
        setPlaceError("No place found. Try adding city, state, or country.");
        return;
      }
      if (placeLooksLikeMasjid(first, text)) {
        const exactMasjid = masjidFromPlaceResult(first);
        setDiscoveredMasjids((current) => mergeMasjidSources(current, [exactMasjid], first.coordinates));
        saveDiscoveredMasjids([exactMasjid, ...discoveredMasjids]);
      }

      const broadAreaRadius = first.areaRadiusKm ?? 0;
      const effectiveRadius = first.isBroadArea || broadAreaRadius > radiusKm * 2
        ? Math.min(150, Math.max(radiusKm, 50, Math.ceil(broadAreaRadius / 2)))
        : radiusKm;
      if (effectiveRadius !== radiusKm) setRadiusKm(effectiveRadius);

      const nearbyResults = await usePlaceResult(first, effectiveRadius);

      // If the selected result is a broad place such as Goa/Kerala/state/region,
      // a 2 km centroid search is not meaningful. Run an area-name mosque search
      // as a rescue layer so users still get real candidates instead of a blank app.
      if (nearbyResults.length < 2 || first.isBroadArea || broadAreaRadius > 12) {
        try {
          const area = await searchAreaMasjids(text, first.coordinates, effectiveRadius);
          if (area.masjids.length) {
            setDiscoveredMasjids((current) => mergeMasjidSources(current, area.masjids, first.coordinates));
            saveDiscoveredMasjids(area.masjids);
            setDiscoveryMessage(`${area.message} Showing candidates sorted from the selected area center. For true nearby results, use your exact phone location or a precise locality.`);
            setDiscoveryError(area.diagnostics?.length ? `Area diagnostics: ${area.diagnostics.slice(0, 6).join(" · ")}` : undefined);
          }
        } catch (areaError) {
          setPlaceError(areaError instanceof Error ? areaError.message : "Area rescue search failed. Try a more specific locality.");
        }
      }
    } catch (error) {
      setPlaceError(error instanceof Error ? error.message : "Could not search that place.");
    } finally {
      setIsSearchingPlace(false);
    }
  }

  async function usePlaceResult(place: PlaceSearchResult, requestedRadius = radiusKm) {
    setLocation(place.coordinates);
    setManualLat(String(Number(place.coordinates.lat.toFixed(6))));
    setManualLng(String(Number(place.coordinates.lng.toFixed(6))));
    setLocationLabel(place.name);
    rememberLocation(place.coordinates, place.name);
    setRememberedLabel(place.name);
    return discoverNearby(place.coordinates, requestedRadius, place.name);
  }

  async function useManualCoordinates() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setLocationError("Enter valid latitude and longitude values.");
      return;
    }
    const coords = { lat, lng };
    setLocation(coords);
    setLocationLabel("manual coordinates");
    rememberLocation(coords, "manual coordinates");
    setRememberedLabel("manual coordinates");
    await discoverNearby(coords, radiusKm, "manual coordinates");
  }

  async function useRememberedLocation() {
    const remembered = readRememberedLocation();
    if (!remembered) {
      setLocationError("No saved location yet. Use location, search a place, or enter manual coordinates.");
      return;
    }
    setLocation(remembered.coordinates);
    setManualLat(String(Number(remembered.coordinates.lat.toFixed(6))));
    setManualLng(String(Number(remembered.coordinates.lng.toFixed(6))));
    setLocationLabel(remembered.label ?? "saved location");
    await discoverNearby(remembered.coordinates, radiusKm, remembered.label ?? "saved location");
  }

  function handleRadiusChange(value: string) {
    const nextRadius = Number(value);
    setRadiusKm(nextRadius);
    if (location) void discoverNearby(location, nextRadius, locationLabel);
  }

  async function handleOsmObjectImport() {
    setOsmImportError(undefined);
    setOsmImportStatus(undefined);

    try {
      const imported = await importOpenStreetMapObject(osmImportText);
      setDiscoveredMasjids((current) => mergeMasjidSources(current, [imported], location));
      saveDiscoveredMasjids([imported, ...discoveredMasjids]);
      setOsmImportStatus(`${imported.name} was imported from OpenStreetMap and added to this device. Open it, verify the exact pin, then submit timings or create a Firestore listing from admin.`);
      setOsmImportText("");
    } catch (error) {
      setOsmImportError(error instanceof Error ? error.message : "Could not import that OpenStreetMap object.");
    }
  }

  const allMasjids = useMemo(
    () => mergeMasjidSources(masjids, discoveredMasjids, location),
    [discoveredMasjids, location, masjids]
  );

  const sortedMasjids = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    // Location-first rule: this page must not show the starter Chennai entries
    // or any other Firestore list as “nearby” until the user gives a location
    // or chooses a place. Distance is the primary sort key for every result.
    if (!location && !savedOnly) return [];

    const filtered = allMasjids
      .map((masjid) => ({
        masjid,
        distance: location ? (displayDistanceKm(location, masjid) ?? distanceKm(location, masjid.coordinates)) : 0
      }))
      .filter(({ masjid, distance }) => {
        if (!location && !savedOnly) return false;
        if (location && distance > radiusKm) return false;
        if (verifiedOnly && !hasVerifiedTimings(masjid)) return false;
        if (hasTimingsOnly && !hasVerifiedTimings(masjid)) return false;
        if (jumuahOnly && !masjid.jumuah.length) return false;
        if (womenFriendlyOnly && !hasFacility(masjid, /ladies|women|female/i)) return false;
        if (parkingOnly && !hasFacility(masjid, /parking/i)) return false;
        if (wheelchairOnly && !hasFacility(masjid, /wheelchair|accessible/i)) return false;
        if (savedOnly && !savedIds.includes(masjid.id)) return false;
        if (directRouteOnly && !isDirectNavigationReady(masjid)) return false;
        if (!normalizedQuery) return true;

        return searchableMasjidText(masjid).includes(normalizedQuery);
      });

    return sortMode === "jamaat" ? rankMasjidsForJamaat(filtered) : nearestRank(filtered);
  }, [allMasjids, directRouteOnly, hasTimingsOnly, jumuahOnly, location, parkingOnly, query, radiusKm, savedIds, savedOnly, sortMode, verifiedOnly, wheelchairOnly, womenFriendlyOnly]);

  const firestoreCount = masjids.length;
  const globalCount = discoveredMasjids.length;
  const lowConfidenceCount = sortedMasjids.filter(({ masjid }) => isLowConfidenceListing(masjid)).length;
  const directRouteCount = sortedMasjids.filter(({ masjid }) => isDirectNavigationReady(masjid)).length;
  const mapsConfirmCount = Math.max(0, sortedMasjids.length - directRouteCount);
  const isBusy = isLocating || isDiscovering || isSearchingPlace;
  const activeFilterCount = [verifiedOnly, hasTimingsOnly, jumuahOnly, womenFriendlyOnly, parkingOnly, wheelchairOnly, savedOnly, directRouteOnly].filter(Boolean).length + (query.trim() ? 1 : 0);
  const speedModeNote = providerResults
    .flatMap((provider) => provider.diagnostics ?? [])
    .find((item) => /Fast mode|Skipped slow OSM/i.test(item));

  function clearAllFilters() {
    setQuery("");
    setVerifiedOnly(false);
    setHasTimingsOnly(false);
    setJumuahOnly(false);
    setWomenFriendlyOnly(false);
    setParkingOnly(false);
    setWheelchairOnly(false);
    setSavedOnly(false);
    setDirectRouteOnly(false);
  }

  return (
    <>
      <AppHeader />
      <main>
        <div className="section-head">
          <div>
            <h2>Nearby masjids</h2>
            <span>{locationLabel ? `Searching around ${locationLabel}` : "Use location or search any place worldwide"}</span>
          </div>
        </div>

        <DataStatus source={source} message={message} isLoading={isLoading} />

        <section className="notice neutral precision-banner">
          <strong>Global Navigation Safety:</strong> the app can discover masjids worldwide, but it never launches blind turn-by-turn navigation to raw Foursquare/Mappls/OSM pins. Verified route-tested masjids show <strong>Start nav</strong>; unverified discoveries show <strong>Confirm in Maps</strong> so users choose the real mosque listing before directions.
        </section>

        <LocationStatus
          isLocating={isLocating}
          isSearchingNearby={isDiscovering}
          hasLocation={Boolean(location)}
          error={locationError}
          onLocate={requestLocation}
        />

        <section className="filter-card compact-location-card" aria-label="Location fallback controls">
          <h3>Location fallback</h3>
          <p className="small-text">If phone GPS is blocked during local testing, enter coordinates or use a searched place. The list will still show masjids sorted by distance from that exact point.</p>
          <div className="field-grid">
            <label>
              Latitude
              <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="13.0827" inputMode="decimal" />
            </label>
            <label>
              Longitude
              <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} placeholder="80.2707" inputMode="decimal" />
            </label>
          </div>
          <div className="card-actions three-actions">
            <button className="ghost-button" type="button" onClick={() => void useManualCoordinates()} disabled={isBusy}>Use coordinates</button>
            {rememberedLabel && <button className="ghost-button" type="button" onClick={() => void useRememberedLocation()} disabled={isBusy}>Use saved</button>}
            <a className="ghost-button" href="https://www.google.com/maps/search/?api=1&query=my+location" target="_blank" rel="noreferrer">Find coords</a>
          </div>
        </section>

        <section className="filter-card" aria-label="Worldwide place search">
          <label>
            Change search area, or filter masjids around your current location
            <div className="input-action-row">
              <input
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchPlaceAndDiscover();
                  }
                }}
                placeholder="Area search: Triplicane, Makkah, Chennai Central. Masjid search after location: masjid, mosque, pallivasal"
              />
              <button className="ghost-button" type="button" onClick={() => void searchPlaceAndDiscover()} disabled={isBusy || !placeQuery.trim()}>
                {isSearchingPlace ? "Searching…" : "Search"}
              </button>
            </div>
          </label>

          {placeResults.length > 1 && (
            <div className="place-result-grid" aria-label="Place search results">
              {placeResults.slice(0, 4).map((place) => (
                <button
                  className="place-result"
                  key={place.id}
                  type="button"
                  onClick={() => void usePlaceResult(place)}
                  disabled={isDiscovering}
                >
                  <strong>{place.name}</strong>
                  <span>{place.displayName}</span>
                  {place.isBroadArea && <small>Broad area — the app will use area rescue search, not only a tiny centroid radius.</small>}
                </button>
              ))}
            </div>
          )}

          {placeError && <div className="notice danger compact">{placeError}</div>}
          {locationLabel && <p className="small-text">Current search center: {locationLabel}</p>}
        </section>

        {discoveryMessage && <div className="notice success compact">{discoveryMessage}</div>}
        {discoveryError && <div className="notice neutral compact">{discoveryError}</div>}

        {searchReport && (
          <section className="info-card qa-mini-report">
            <div className="section-inline-head">
              <div>
                <h3>Search report</h3>
                <p className="small-text">Final accepted results: {searchReport.finalCount} · Radius checked: {searchReport.radiusKm} km</p>
              </div>
              <Link className="ghost-button" href={searchReport.qaHref}>Open QA lab</Link>
            </div>
            <p className="small-text">{searchReport.providerBreakdown}</p>
            {searchReport.noResultReason && <div className="notice danger-soft compact">{searchReport.noResultReason}</div>}
          </section>
        )}

        <section className="filter-card" aria-label="Masjid filters">
          <label>
            Filter loaded results by masjid, area, facility, source, or language
            <div className="input-action-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Example: Triplicane, Wudu, Urdu, OpenStreetMap"
              />
              <button className="ghost-button" type="button" onClick={() => setQuery("")} disabled={!query.trim()}>Clear</button>
            </div>
          </label>

          <div className="field-grid">
            <label>
              Search radius
              <select value={String(radiusKm)} onChange={(event) => handleRadiusChange(event.target.value)}>
                {radiusOptions.map((radius) => (
                  <option value={radius} key={radius}>{radius} km</option>
                ))}
              </select>
            </label>
            <label>
              Sort mode
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "nearest" | "jamaat")}>
                <option value="nearest">Nearest first</option>
                <option value="jamaat">Best for next jamaat</option>
              </select>
            </label>
            <label>
              Precision discovery
              <button
                className="ghost-button full"
                type="button"
                onClick={() => (location ? void discoverNearby(location, radiusKm, locationLabel) : requestLocation())}
                disabled={isBusy}
              >
                {isDiscovering ? "Checking…" : location ? "Refresh" : "Use location"}
              </button>
            </label>
          </div>

          <div className="filter-chip-grid" aria-label="Power filters">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
              />
              Verified only
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={hasTimingsOnly}
                onChange={(event) => setHasTimingsOnly(event.target.checked)}
              />
              Has jamaat timings
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={jumuahOnly}
                onChange={(event) => setJumuahOnly(event.target.checked)}
              />
              Jumu’ah listed
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={womenFriendlyOnly}
                onChange={(event) => setWomenFriendlyOnly(event.target.checked)}
              />
              Ladies area
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={parkingOnly}
                onChange={(event) => setParkingOnly(event.target.checked)}
              />
              Parking
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={wheelchairOnly}
                onChange={(event) => setWheelchairOnly(event.target.checked)}
              />
              Wheelchair access
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(event) => {
                  setSavedIds(getSavedMasjidIds());
                  setSavedOnly(event.target.checked);
                }}
              />
              Saved only
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={directRouteOnly}
                onChange={(event) => setDirectRouteOnly(event.target.checked)}
              />
              Direct-route ready only
            </label>
          </div>
          {activeFilterCount > 0 && (
            <div className="filter-reset-card">
              <span>{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span>
              <button className="ghost-button" type="button" onClick={clearAllFilters}>Clear all filters</button>
            </div>
          )}
          {speedModeNote && (
            <div className="speed-mode-card">
              <strong>Fast discovery mode</strong>
              <p>{speedModeNote}</p>
            </div>
          )}
          {sortedMasjids[0] && (
            <div className="smart-recommendation-card">
              <span>{sortMode === "jamaat" ? "Best for next jamaat" : "Nearest practical option"}</span>
              <strong>{sortMode === "jamaat" ? sortedMasjids[0].reach.headline : sortedMasjids[0].masjid.name}</strong>
              <p>{sortedMasjids[0].reach.detail}</p>
            </div>
          )}
          <div className="results-summary-card">
            <strong>{sortedMasjids.length}</strong>
            <span>{location ? `nearby masjid listing${sortedMasjids.length === 1 ? "" : "s"} within ${radiusKm} km, sorted ${sortMode === "jamaat" ? "by next-jamaat reachability" : "nearest first"}` : "give a location or search place to load distance-ranked masjids"}</span>
          </div>
          {location && sortedMasjids.length > 0 && (
            <div className="navigation-summary-card">
              <strong>Navigation safety</strong>
              <p>{directRouteCount} direct-route ready · {mapsConfirmCount} require Google Maps confirmation before directions.</p>
              <span>Worldwide accuracy rule: show nearby discoveries, but block blind raw-pin routing until the pin is verified or backed by a Google Place ID.</span>
            </div>
          )}
          <p className="small-text">
            Loaded after this search: {allMasjids.length}. Firestore nearby candidates: {firestoreCount}. External candidates: {globalCount}. {providerStatus}
          </p>
          {lowConfidenceCount > 0 && <p className="small-text warning-text">{lowConfidenceCount} listing(s) are low-confidence unnamed pins. Verify them before relying on them.</p>}
          {providerResults.length > 0 && (
            <div className="provider-health-grid">
              {providerResults.map((provider, index) => (
                <div className={provider.enabled ? "provider-health-card" : "provider-health-card muted"} key={providerHealthGridKey(provider, index)}>
                  <span>{provider.label}</span>
                  <strong>{provider.enabled ? `${provider.count} found` : "Not configured"}</strong>
                  <small>{provider.error ?? provider.message ?? (provider.cached ? "cached" : "ready")}</small>
                </div>
              ))}
            </div>
          )}
          <p className="small-text">Best coverage model: Firestore for verified jamaat timings, optional Google Places for Google Maps POIs, Mappls/Foursquare for extra coverage, OpenStreetMap fallback, and exact-pin community reports.</p>
          <p className="small-text">Mappls/Foursquare keys improve coverage. Google Places is optional if you need the same mosque POIs that appear inside Google Maps. Without provider keys, the app depends mostly on Firestore + OpenStreetMap fallback.</p>

          <div className="card-actions three-actions utility-actions">
            {location && <a className="ghost-button" href={googleMapsNearbyMasjidSearchUrl(location)} target="_blank" rel="noreferrer">Google Maps nearby</a>}
            {location && <a className="ghost-button" href={openStreetMapNearbySearchUrl(location)} target="_blank" rel="noreferrer">OSM search</a>}
            <Link className="secondary-button" href="/missing">Report missing</Link>
          </div>
        </section>

        <section className="filter-card accuracy-card" aria-label="OpenStreetMap exact link import">
          <div className="section-inline-head">
            <div>
              <h3>Found it on OpenStreetMap?</h3>
              <p className="small-text">Paste the OSM node/way/relation link. This fixes cases where the OSM website can find a mosque but nearby discovery did not catch it automatically.</p>
            </div>
          </div>
          <div className="input-action-row">
            <input
              value={osmImportText}
              onChange={(event) => setOsmImportText(event.target.value)}
              placeholder="https://www.openstreetmap.org/way/123456"
            />
            <button className="ghost-button" type="button" onClick={() => void handleOsmObjectImport()} disabled={!osmImportText.trim()}>Import</button>
          </div>
          {osmImportStatus && <div className="notice success compact">{osmImportStatus}</div>}
          {osmImportError && <div className="notice danger compact">{osmImportError}</div>}
        </section>

        <div className="masjid-list">
          {sortedMasjids.map(({ masjid, distance }, index) => (
            <Fragment key={`nearby-${masjid.id}`}>
              <MasjidCard masjid={masjid} distanceKm={distance} origin={location} rank={index + 1} />
              {index === 2 && <AdSlot placement="nearby-feed" compact />}
            </Fragment>
          ))}
          {!sortedMasjids.length && (
            <section className="info-card empty-state">
              <h2>{location ? "No masjids match this location/filter" : "Give a location first"}</h2>
              <p>{location ? "Try clearing search, turning off verified-only mode, expanding the radius, searching a nearby landmark, or reporting the missing masjid so it can be verified." : "This page no longer displays the five starter Chennai listings by default. Tap Use my location or search a city/area so every result has a real distance from the user."}</p>
              <div className="card-actions">
                {activeFilterCount > 0 && <button className="ghost-button" type="button" onClick={clearAllFilters}>Clear filters</button>}
                {location && <a className="ghost-button" href={googleMapsNearbyMasjidSearchUrl(location)} target="_blank" rel="noreferrer">Open Google Maps search</a>}
                {searchReport && <Link className="ghost-button" href={searchReport.qaHref}>Debug this search</Link>}
                <Link className="secondary-button" href="/missing">Report missing masjid</Link>
              </div>
            </section>
          )}
        </div>

        <div className="footer-space" />
      </main>
    </>
  );
}
