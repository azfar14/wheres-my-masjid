"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useMasjid } from "@/hooks/useMasjids";
import { createClaimRequest } from "@/lib/masjidService";
import { displayMasjidLocality, displayMasjidName } from "@/lib/masjidDisplay";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
  const params = useParams<{ id: string }>();
  const id = firstParam(params?.id);
  const { masjid, isLoading } = useMasjid(id);
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
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

    if (!id || !masjid) {
      setError("Masjid listing was not found.");
      return;
    }

    if (!requesterName.trim() || !requesterPhone.trim() || !role.trim() || !proof.trim()) {
      setError("Name, phone, role, and proof are required.");
      return;
    }

    if (!declaration) {
      setError("Confirm that you are authorised to request access for this masjid.");
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
        proof: buildProofText({ role, proofType, officialContact, proof, currentTimings }),
        notes: [
          notes.trim() ? `Extra notes: ${notes.trim()}` : "",
          `Listing locality: ${displayMasjidLocality(masjid)}`,
          "Declaration: claimant says they are authorised and understands access is not instant."
        ].filter(Boolean).join("\n")
      });
      setStatus("Claim request submitted. Admin will verify the proof/contact, then assign masjid-only access after approval.");
      setProof("");
      setCurrentTimings("");
      setNotes("");
      setDeclaration(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit claim request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="claim-page safe-layout-page">
        <section className="hero-card claim-hero">
          <p className="kicker">Masjid admin claim</p>
          <h2 className="hero-title">Claim this masjid safely.</h2>
          <div className="hero-meta">
            <span className="pill">{isLoading ? "Loading…" : masjid ? displayMasjidName(masjid) : "Masjid not found"}</span>
            {masjid && <span className="pill">{displayMasjidLocality(masjid)}</span>}
          </div>
          <p className="small-text">This protects the masjid from random edits. Claims are manually checked before any edit access is assigned.</p>
          <div className="cta-row premium-cta-row">
            <Link className="secondary-button" href="/my-masjids">Approved dashboard</Link>
            <Link className="ghost-button" href="/network">Network plan</Link>
          </div>
        </section>

        <section className="info-card claim-security-card">
          <h3>What happens after you submit?</h3>
          <div className="claim-process-grid">
            <article className="claim-step-card"><span>1</span><strong>Review request</strong><p>The owner/admin sees your claim in the private verification dashboard.</p></article>
            <article className="claim-step-card"><span>2</span><strong>Verify proof</strong><p>Admin confirms by office phone, committee contact, timetable proof, or local verification.</p></article>
            <article className="claim-step-card"><span>3</span><strong>Assign access</strong><p>If approved, your Firebase Auth UID is assigned to this masjid only.</p></article>
            <article className="claim-step-card"><span>4</span><strong>Keep data fresh</strong><p>You can help maintain jamaat timings, Jumu’ah, facilities, and announcements.</p></article>
          </div>
        </section>

        {status && <div className="notice success compact">{status}</div>}
        {error && <div className="notice danger compact">{error}</div>}

        {!masjid && !isLoading ? (
          <section className="info-card empty-state">
            <h2>Listing not found</h2>
            <p>Search nearby again or report this masjid as missing with the exact pin.</p>
            <div className="card-actions">
              <Link className="button" href="/nearby">Back to nearby</Link>
              <Link className="ghost-button" href="/missing">Report missing</Link>
            </div>
          </section>
        ) : (
          <form className="info-card form-stack claim-form" onSubmit={handleSubmit}>
            <h3>Claim request form</h3>
            <p className="small-text">No instant access is given. The admin must verify your role and proof before assigning this listing.</p>
            <label>
              Your name
              <input value={requesterName} onChange={(event) => setRequesterName(event.target.value)} placeholder="Full name" required />
            </label>
            <div className="field-grid">
              <label>
                Phone / WhatsApp
                <input value={requesterPhone} onChange={(event) => setRequesterPhone(event.target.value)} placeholder="+91…" required />
              </label>
              <label>
                Email, optional
                <input type="email" value={requesterEmail} onChange={(event) => setRequesterEmail(event.target.value)} placeholder="you@example.com" />
              </label>
            </div>
            <label>
              Your authorised role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option>Committee member / trustee</option>
                <option>Imam</option>
                <option>Muazzin</option>
                <option>Authorised caretaker</option>
                <option>Office administrator</option>
                <option>Other authorised representative</option>
              </select>
            </label>
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
            <label>
              Masjid office / known verification contact
              <input value={officialContact} onChange={(event) => setOfficialContact(event.target.value)} placeholder="Office number, committee contact, or official page" />
            </label>
            <label>
              Proof / verification detail
              <textarea value={proof} onChange={(event) => setProof(event.target.value)} placeholder="Example: I am on the committee. Call the masjid office at this number. The timetable is on the notice board. Mention any proof admins can verify." required />
            </label>
            <label>
              Current jamaat / Jumu’ah timings, optional
              <textarea value={currentTimings} onChange={(event) => setCurrentTimings(event.target.value)} placeholder="Example: Fajr 5:10, Dhuhr 1:30, Asr 5:15, Maghrib 6:45, Isha 8:15, Jumu’ah 1:15" />
            </label>
            <label>
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything else the admin should know" />
            </label>

            <label className="inline-check claim-declaration">
              <input type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} />
              <span>I confirm I am authorised to request access for this masjid. I understand the claim will be manually verified and can be rejected.</span>
            </label>

            <div className="card-actions">
              <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit claim for review"}</button>
              <Link className="ghost-button" href={masjid ? `/masjid/${masjid.id}` : "/nearby"}>Back</Link>
            </div>
          </form>
        )}
        <div className="footer-space" />
      </main>
    </>
  );
}
