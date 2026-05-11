"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { createClaimRequest } from "@/lib/masjidService";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export default function ClaimMasjidPage() {
  const [masjidName, setMasjidName] = useState("");
  const [area, setArea] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);

    if (!masjidName.trim() || !contactName.trim() || !phone.trim()) {
      setError("Add masjid name, contact person, and phone number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const claimId = slugify(`${masjidName}-${area}`) || `claim-${Date.now()}`;
      await createClaimRequest({
        masjidId: claimId,
        masjidName: masjidName.trim(),
        requesterName: contactName.trim(),
        requesterPhone: phone.trim(),
        requesterEmail: email.trim() || undefined,
        role: role.trim() || "Masjid representative",
        proof: notes.trim() || "Needs manual verification",
        notes: area.trim() ? `Area: ${area.trim()}` : undefined
      });
      setStatus("Claim request submitted. The owner/admin can verify the contact and assign dashboard access later.");
      setMasjidName("");
      setArea("");
      setContactName("");
      setPhone("");
      setEmail("");
      setRole("");
      setNotes("");
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not submit claim request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main>
        <section className="hero-card">
          <p className="kicker">Masjid claim</p>
          <h2 className="hero-title">Let masjid committees keep jamaat timings accurate.</h2>
          <p className="small-text">This is a placeholder MVP claim flow. In production, each verified committee gets permission to edit only its own masjid.</p>
        </section>

        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        <form className="info-card form-stack" onSubmit={handleSubmit}>
          <label>Masjid name<input value={masjidName} onChange={(event) => setMasjidName(event.target.value)} required /></label>
          <label>Area<input value={area} onChange={(event) => setArea(event.target.value)} /></label>
          <label>Contact person<input value={contactName} onChange={(event) => setContactName(event.target.value)} required /></label>
          <label>Role / relationship<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Committee member, imam, volunteer, etc." /></label>
          <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
          <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything useful for verification" /></label>
          <div className="card-actions">
            <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit claim"}</button>
            <Link className="ghost-button" href="/nearby">Find masjid</Link>
          </div>
        </form>

        <div className="footer-space" />
      </main>
    </>
  );
}
