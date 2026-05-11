"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { exactCoordinateSearchUrl, openStreetMapPinUrl } from "@/lib/geo";
import { createSuggestion } from "@/lib/masjidService";
import { searchPlaces } from "@/lib/placeSearchService";
import { locationProblemMessage } from "@/lib/browserSupport";

function buildMissingMasjidText(input: {
  name: string;
  area: string;
  address: string;
  mapsLink: string;
  lat: string;
  lng: string;
  notes: string;
}): string {
  return [
    "Missing masjid report",
    `Name: ${input.name || "Not provided"}`,
    `Area: ${input.area || "Not provided"}`,
    `Address: ${input.address || "Not provided"}`,
    `Map link: ${input.mapsLink || "Not provided"}`,
    `Latitude: ${input.lat || "Not provided"}`,
    `Longitude: ${input.lng || "Not provided"}`,
    `Notes: ${input.notes || "Not provided"}`
  ].join("\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function extractCoordinates(value: string): { lat: number; lng: number } | undefined {
  const decoded = decodeURIComponent(value || "");
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return undefined;
}

export default function MissingMasjidPage() {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const numericLat = Number(lat);
  const numericLng = Number(lng);
  const hasCoordinates = Number.isFinite(numericLat) && Number.isFinite(numericLng);
  const coordinatePreview = hasCoordinates ? { lat: numericLat, lng: numericLng } : undefined;

  function useCurrentLocation() {
    setError(undefined);
    if (!("geolocation" in navigator)) {
      setError(locationProblemMessage().message);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(String(position.coords.latitude));
        setLng(String(position.coords.longitude));
        setStatus("Current location added. Adjust it if you are not standing at the masjid gate/exact pin.");
      },
      (error) => setError(locationProblemMessage(error).message),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
  }

  function handleExtractCoordinates() {
    setError(undefined);
    setStatus(undefined);
    const coordinates = extractCoordinates(mapsLink || address);
    if (!coordinates) {
      setError("Could not find coordinates in that text. Paste a full map link with @lat,lng, or use Search address.");
      return;
    }
    setLat(String(coordinates.lat));
    setLng(String(coordinates.lng));
    setStatus("Exact coordinates extracted. Check the pin preview links before submitting.");
  }

  async function handleSearchAddress() {
    setError(undefined);
    setStatus(undefined);
    const query = [name, address, area].filter(Boolean).join(", ");
    if (!query.trim()) {
      setError("Add a name, address, or area before searching.");
      return;
    }

    setIsGeocoding(true);
    try {
      const places = await searchPlaces(query);
      const place = places[0];
      setLat(String(place.coordinates.lat));
      setLng(String(place.coordinates.lng));
      if (!address.trim()) setAddress(place.displayName);
      if (!area.trim()) setArea(place.name);
      setStatus(`Best matching pin selected: ${place.displayName}. Verify this pin before submitting.`);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Could not search that address.");
    } finally {
      setIsGeocoding(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);

    if (!name.trim() && !address.trim() && !mapsLink.trim()) {
      setError("Add at least a masjid name, address, or map link.");
      return;
    }

    if (!hasCoordinates) {
      setError("Add an exact pin first. Use current location, extract coordinates from a map link, or search the address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const suggestedValue = buildMissingMasjidText({ name, area, address, mapsLink, lat, lng, notes });
      const reportId = slugify(name || area || `missing-${Date.now()}`) || `missing-${Date.now()}`;

      await createSuggestion({
        masjidId: `missing-${reportId}`,
        field: "other",
        suggestedValue,
        notes: "Public missing masjid report with exact pin",
        masjidSnapshot: {
          id: `missing-${reportId}`,
          name: name.trim() || "Missing masjid report",
          locality: area.trim() || "Area not provided",
          address: address.trim() || mapsLink.trim() || "Address not provided",
          coordinates: { lat: numericLat, lng: numericLng },
          source: "community_report" as const,
          discoveryQuality: "medium" as const
        }
      });
      setStatus("Missing masjid report submitted with an exact pin. An admin can verify it and add it to Firestore.");
      setName("");
      setArea("");
      setAddress("");
      setMapsLink("");
      setLat("");
      setLng("");
      setNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit missing masjid report.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card">
          <p className="kicker">Help improve coverage</p>
          <h2 className="hero-title">Report a missing masjid with an exact pin.</h2>
          <p className="small-text">This is how the app becomes better than generic maps: users submit exact masjid pins, admins verify them, and jamaat timings become trusted.</p>
        </section>

        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        <form className="info-card form-stack" onSubmit={handleSubmit}>
          <label>
            Masjid name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Masjid-e-Noor" />
          </label>
          <label>
            Area / locality
            <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Example: Triplicane, Chennai" />
          </label>
          <label>
            Address or nearby landmark
            <textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, landmark, building, or area" />
          </label>
          <label>
            Map link or coordinate text
            <input value={mapsLink} onChange={(event) => setMapsLink(event.target.value)} placeholder="Paste Google Maps / OSM link or @lat,lng" />
          </label>

          <div className="card-actions three-actions">
            <button className="ghost-button" type="button" onClick={useCurrentLocation}>Use current pin</button>
            <button className="ghost-button" type="button" onClick={handleExtractCoordinates}>Extract coordinates</button>
            <button className="ghost-button" type="button" onClick={() => void handleSearchAddress()} disabled={isGeocoding}>{isGeocoding ? "Searching…" : "Search address"}</button>
          </div>

          <div className="field-grid">
            <label>
              Latitude
              <input value={lat} onChange={(event) => setLat(event.target.value)} placeholder="Required exact pin" />
            </label>
            <label>
              Longitude
              <input value={lng} onChange={(event) => setLng(event.target.value)} placeholder="Required exact pin" />
            </label>
          </div>

          {coordinatePreview && (
            <div className="notice neutral compact">
              Exact pin ready. Open it before submitting: <a href={exactCoordinateSearchUrl(coordinatePreview)} target="_blank" rel="noreferrer">Google Maps</a> · <a href={openStreetMapPinUrl(coordinatePreview)} target="_blank" rel="noreferrer">OpenStreetMap</a>
            </div>
          )}

          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: The masjid is inside the lane behind the restaurant. Jumu’ah is at 1:15 PM." />
          </label>

          <div className="card-actions">
            <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit missing masjid"}</button>
            <Link className="ghost-button" href="/nearby">Back to nearby</Link>
          </div>
        </form>

        <div className="footer-space" />
      </main>
    </>
  );
}
