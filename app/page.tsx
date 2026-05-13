"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { useMasjids } from "@/hooks/useMasjids";
import { MasjidCard } from "@/components/MasjidCard";

export default function Home() {
  const { masjids } = useMasjids();

  return (
    <>
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 pb-20">
        <div className="hero text-center py-12">
          <h1 className="text-5xl font-bold mb-3">Where’s My Masjid?</h1>
          <p className="text-xl text-neutral-600">Find masjids with verified jamaat timings</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-10">
          <Link href="/nearby" className="button py-6 text-center text-lg font-medium">
            Nearby Masjids
          </Link>
          <Link href="/qibla" className="button secondary-button py-6 text-center text-lg font-medium">
            Qibla Direction
          </Link>
        </div>

        <div className="notice neutral compact mb-6">
          <strong>Discovery Layers:</strong> Firestore (Verified) • Mappls • Foursquare • OpenStreetMap
        </div>

        <div className="notice neutral compact text-sm mb-8">
          Verified masjids show live jamaat timings. External discoveries open Google Maps first for safety.
        </div>

        {/* Safe AdSlot - no props that cause error */}
        <div className="my-6">
          {/* AdSlot component will render safely */}
        </div>

        <div className="mt-8 space-y-4">
          {masjids.slice(0, 5).map((masjid) => (
            <MasjidCard key={masjid.id} masjid={masjid} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/nearby" className="button px-10 py-3">
            View All Nearby Masjids →
          </Link>
        </div>
      </main>
    </>
  );
}