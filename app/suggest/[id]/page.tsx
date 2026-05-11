"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DataStatus } from "@/components/DataStatus";
import { useMasjid } from "@/hooks/useMasjids";
import { createSuggestion } from "@/lib/masjidService";
import type { SuggestionField } from "@/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SuggestUpdatePage() {
  const params = useParams<{ id: string }>();
  const id = firstParam(params?.id);
  const { masjid, source, message, isLoading } = useMasjid(id);
  const [field, setField] = useState<SuggestionField>("jamaat");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);

    if (!id) {
      setError("Missing masjid id.");
      return;
    }

    setIsSaving(true);
    try {
      const masjidSnapshot = masjid
        ? {
            id: masjid.id,
            name: masjid.name,
            locality: masjid.locality,
            address: masjid.address,
            coordinates: masjid.coordinates,
            ...(masjid.source ? { source: masjid.source } : {}),
            ...(masjid.osm ? { osm: masjid.osm } : {}),
            ...(masjid.googlePlaceId ? { googlePlaceId: masjid.googlePlaceId } : {}),
            ...(masjid.googleMapsUri ? { googleMapsUri: masjid.googleMapsUri } : {})
          }
        : undefined;

      const suggestionId = await createSuggestion({
        masjidId: id,
        field,
        suggestedValue,
        ...(notes.trim() ? { notes } : {}),
        ...(masjidSnapshot ? { masjidSnapshot } : {})
      });
      setSuggestedValue("");
      setNotes("");
      setStatus(`Suggestion submitted. Reference: ${suggestionId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit suggestion.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <main><div className="notice neutral">Loading suggestion form…</div></main>
      </>
    );
  }

  if (!masjid) {
    return (
      <>
        <AppHeader />
        <main>
          <section className="info-card empty-state">
            <h2>Masjid not found</h2>
            <p>This listing may not exist yet.</p>
            <Link className="ghost-button full" href="/nearby">Back to nearby list</Link>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main>
        <DataStatus source={source} message={message} />

        <section className="hero-card">
          <p className="kicker">Community update</p>
          <h2 className="hero-title">Suggest a correction for {masjid.name}.</h2>
        </section>

        <form className="form-card" onSubmit={handleSubmit}>
          <label>
            What needs correction?
            <select value={field} onChange={(event) => setField(event.target.value as SuggestionField)}>
              <option value="jamaat">Jamaat timing</option>
              <option value="jumuah">Jumu’ah timing</option>
              <option value="facility">Facility</option>
              <option value="address">Address/location</option>
              <option value="phone">Phone number</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            New value
            <input value={suggestedValue} onChange={(event) => setSuggestedValue(event.target.value)} placeholder="Example: Asr 17:20 or Fajr 5:10 AM" required />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add source, proof, or who confirmed it." />
          </label>
          <label>
            Timetable photo
            <input type="file" accept="image/*" disabled />
          </label>
          <button className="button full" type="submit" disabled={isSaving}>
            {isSaving ? "Submitting…" : "Submit suggestion"}
          </button>
        </form>

        <div className="notice neutral">
          Suggestions are saved to Firestore as pending corrections. If this is an OpenStreetMap discovery listing, the masjid snapshot is saved too so an admin can create a verified Firestore listing later.
        </div>

        {status && <div className="notice success">{status}</div>}
        {error && <div className="notice danger">{error}</div>}

        <Link className="ghost-button full" href={`/masjid/${masjid.id}`}>Back to masjid</Link>
        <div className="footer-space" />
      </main>
    </>
  );
}
