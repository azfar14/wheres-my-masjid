"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useMasjid } from "@/hooks/useMasjids";
import { createClaimRequest } from "@/lib/masjidService";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ClaimMasjidPage() {
  const params = useParams<{ id: string }>();
  const id = firstParam(params?.id);
  const { masjid, isLoading } = useMasjid(id);
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [role, setRole] = useState("Masjid committee member");
  const [proof, setProof] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);

    if (!id || !masjid) {
      setError("Masjid listing was not found.");
      return;
    }

    if (!requesterName.trim() || !requesterPhone.trim() || !role.trim() || !proof.trim()) {
      setError("Name, phone, role, and proof are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createClaimRequest({
        masjidId: id,
        masjidName: masjid.name,
        requesterName: requesterName.trim(),
        requesterPhone: requesterPhone.trim(),
        requesterEmail: requesterEmail.trim() || undefined,
        role: role.trim(),
        proof: proof.trim(),
        notes: notes.trim() || undefined
      });
      setStatus("Claim request submitted. An admin will verify it before giving edit access.");
      setProof("");
      setNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit claim request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card">
          <p className="kicker">Masjid admin claim</p>
          <h2 className="hero-title">Claim this listing.</h2>
          <div className="hero-meta">
            <span className="pill">{isLoading ? "Loading…" : masjid?.name ?? "Masjid not found"}</span>
          </div>
        </section>

        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        {!masjid && !isLoading ? (
          <section className="info-card empty-state">
            <h2>Listing not found</h2>
            <p>Search nearby again or report this masjid as missing.</p>
            <Link className="button full" href="/nearby">Back to nearby</Link>
          </section>
        ) : (
          <form className="info-card form-stack" onSubmit={handleSubmit}>
            <p className="small-text">This does not give instant access. It creates a verification request so the platform can protect masjid data from random edits.</p>
            <label>
              Your name
              <input value={requesterName} onChange={(event) => setRequesterName(event.target.value)} placeholder="Full name" required />
            </label>
            <label>
              Phone / WhatsApp
              <input value={requesterPhone} onChange={(event) => setRequesterPhone(event.target.value)} placeholder="+91…" required />
            </label>
            <label>
              Email, optional
              <input type="email" value={requesterEmail} onChange={(event) => setRequesterEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label>
              Your role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option>Masjid committee member</option>
                <option>Imam / Muazzin</option>
                <option>Volunteer</option>
                <option>Local regular worshipper</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Proof / verification detail
              <textarea value={proof} onChange={(event) => setProof(event.target.value)} placeholder="Example: I am on the committee. Call the masjid office at this number. Timetable photo is on notice board. Mention any proof admins can verify." required />
            </label>
            <label>
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything else the admin should know" />
            </label>
            <div className="card-actions">
              <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit claim"}</button>
              <Link className="ghost-button" href={masjid ? `/masjid/${masjid.id}` : "/nearby"}>Back</Link>
            </div>
          </form>
        )}
        <div className="footer-space" />
      </main>
    </>
  );
}
