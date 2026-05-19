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

function buildProofText(input: {
  role: string;
  proofType: string;
  officialContact: string;
  proof: string;
  currentTimings: string;
}): string {
  return [
    `Role: ${input.role}`,
    `Proof type: ${input.proofType}`,
    `Masjid office / known verification contact: ${input.officialContact || "Not provided"}`,
    `Proof detail: ${input.proof}`,
    `Current timings provided by claimant: ${input.currentTimings || "Not provided"}`
  ].join("\n");
}

export default function ClaimMasjidPage() {
  const [masjidName, setMasjidName] = useState("");
  const [area, setArea] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Committee member / trustee");
  const [proofType, setProofType] = useState("Masjid office confirmation");
  const [officialContact, setOfficialContact] = useState("");
  const [proof, setProof] = useState("");
  const [currentTimings, setCurrentTimings] = useState("");
  const [notes, setNotes] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);

    if (!masjidName.trim() || !area.trim() || !contactName.trim() || !phone.trim() || !proof.trim()) {
      setError("Add masjid name, area, contact person, phone, and proof details.");
      return;
    }

    if (!declaration) {
      setError("Confirm that you are authorised to request access for this masjid.");
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
        role: role.trim(),
        proof: buildProofText({ role, proofType, officialContact, proof, currentTimings }),
        notes: [
          `Area: ${area.trim()}`,
          notes.trim() ? `Extra notes: ${notes.trim()}` : "",
          "Declaration: claimant says they are authorised and understands access is not instant."
        ].filter(Boolean).join("\n")
      });
      setStatus("Claim request submitted. Admin will verify the contact/proof, then assign masjid-only access after approval.");
      setMasjidName("");
      setArea("");
      setContactName("");
      setPhone("");
      setEmail("");
      setRole("Committee member / trustee");
      setProofType("Masjid office confirmation");
      setOfficialContact("");
      setProof("");
      setCurrentTimings("");
      setNotes("");
      setDeclaration(false);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not submit claim request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="claim-page safe-layout-page">
        <section className="hero-card claim-hero">
          <p className="kicker">Masjid head claim</p>
          <h2 className="hero-title">Give authorised masjid teams a safe way to update their own timings.</h2>
          <p className="small-text">Claims are reviewed manually. No public user gets instant edit access, and approved users are limited to their own masjid listing.</p>
          <div className="cta-row premium-cta-row">
            <Link className="secondary-button" href="/nearby">Find existing listing</Link>
            <Link className="ghost-button" href="/my-masjids">Approved dashboard</Link>
          </div>
        </section>

        <section className="info-card claim-security-card">
          <h3>Proper approval procedure</h3>
          <div className="claim-process-grid">
            <article className="claim-step-card"><span>1</span><strong>Claim submitted</strong><p>Collect claimant identity, role, phone/email, masjid area, and proof.</p></article>
            <article className="claim-step-card"><span>2</span><strong>Admin verifies</strong><p>Verify by masjid office call, local confirmation, timetable photo, or committee proof.</p></article>
            <article className="claim-step-card"><span>3</span><strong>Access assigned</strong><p>Create/confirm Firebase Auth user and assign that UID to only this masjid.</p></article>
            <article className="claim-step-card"><span>4</span><strong>Timings maintained</strong><p>Approved masjid admins keep jamaat, Jumu’ah, facilities, and updates fresh.</p></article>
          </div>
        </section>

        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        <form className="info-card form-stack claim-form" onSubmit={handleSubmit}>
          <h3>Claim request form</h3>
          <p className="small-text">Use this when the masjid is not selected from a listing yet. If the listing already exists, open the listing and tap “Claim this masjid”.</p>

          <label>Masjid name<input value={masjidName} onChange={(event) => setMasjidName(event.target.value)} placeholder="Example: Masjid-e-Noor" required /></label>
          <label>Area / locality<input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Example: Triplicane, Chennai" required /></label>
          <label>Contact person<input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Full name" required /></label>
          <label>
            Role / relationship
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option>Committee member / trustee</option>
              <option>Imam</option>
              <option>Muazzin</option>
              <option>Authorised caretaker</option>
              <option>Office administrator</option>
              <option>Other authorised representative</option>
            </select>
          </label>
          <div className="field-grid">
            <label>Phone / WhatsApp<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91…" required /></label>
            <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="committee@example.com" /></label>
          </div>
          <label>
            Proof type
            <select value={proofType} onChange={(event) => setProofType(event.target.value)}>
              <option>Masjid office confirmation</option>
              <option>Committee/trustee confirmation</option>
              <option>Imam or muazzin confirmation</option>
              <option>Notice-board / timetable proof</option>
              <option>Official phone/email/social page</option>
              <option>Local in-person verification needed</option>
            </select>
          </label>
          <label>Masjid office / known verification contact<input value={officialContact} onChange={(event) => setOfficialContact(event.target.value)} placeholder="Office number, committee contact, or official page" /></label>
          <label>Proof / verification detail<textarea value={proof} onChange={(event) => setProof(event.target.value)} placeholder="Explain how admin can verify you. Example: call the masjid office, check notice board, verify with trustee, timetable photo available, etc." required /></label>
          <label>Current jamaat / Jumu’ah timings, optional<textarea value={currentTimings} onChange={(event) => setCurrentTimings(event.target.value)} placeholder="Example: Fajr 5:10, Dhuhr 1:30, Asr 5:15, Maghrib 6:45, Isha 8:15, Jumu’ah 1:15" /></label>
          <label>Extra notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything else the admin should know" /></label>

          <label className="inline-check claim-declaration">
            <input type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} />
            <span>I confirm I am authorised to request access for this masjid. I understand the claim will be manually verified and can be rejected.</span>
          </label>

          <div className="card-actions">
            <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit claim for review"}</button>
            <Link className="ghost-button" href="/network">How it works</Link>
          </div>
        </form>

        <div className="footer-space" />
      </main>
    </>
  );
}
