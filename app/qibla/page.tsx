"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { readRememberedLocation } from "@/lib/locationMemory";
import { searchPlaces } from "@/lib/placeSearchService";
import type { Coordinates } from "@/types";

const KAABA = { lat: 21.4225, lng: 39.8262 };

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const λ2 = (lon2 * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

export default function QiblaPage() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationLabel, setLocationLabel] = useState("Saved location");
  const [qiblaBearing, setQiblaBearing] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [compassSupported, setCompassSupported] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [accuracy, setAccuracy] = useState("");

  // Load saved location
  useEffect(() => {
    const remembered = readRememberedLocation();
    if (remembered) {
      setLocation(remembered.coordinates);
      setLocationLabel(remembered.label || "Saved location");
    } else {
      setLocation({ lat: 13.0827, lng: 80.2707 });
      setLocationLabel("Chennai (default)");
    }
  }, []);

  // Calculate Qibla bearing
  useEffect(() => {
    if (!location) return;
    const bearing = calculateBearing(location.lat, location.lng, KAABA.lat, KAABA.lng);
    setQiblaBearing(Math.round(bearing));
  }, [location]);

  // Device Compass with safe typing
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      let heading = 0;

      // Safe check for webkitCompassHeading
      const webkitHeading = (event as any).webkitCompassHeading;
      if (typeof webkitHeading === "number") {
        heading = webkitHeading;
        setCompassSupported(true);
      } 
      // Fallback for other browsers
      else if (event.alpha !== null && event.alpha !== undefined) {
        heading = 360 - event.alpha;
        setCompassSupported(true);
      }

      if (heading) setDeviceHeading(heading);
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  const requestLocation = async () => {
    setIsLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
        });
      });
      const coords: Coordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(coords);
      setLocationLabel("Your current location");
      setAccuracy(`±${Math.round(pos.coords.accuracy)}m`);
    } catch {
      setAccuracy("Location access failed.");
    } finally {
      setIsLocating(false);
    }
  };

  const searchPlace = async () => {
    if (!placeQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchPlaces(placeQuery.trim());
      if (results.length > 0) {
        const best = results[0];
        setLocation(best.coordinates);
        setLocationLabel(best.name || best.displayName);
        setAccuracy("From search");
      }
    } catch {
      alert("Place not found.");
    } finally {
      setIsSearching(false);
      setPlaceQuery("");
    }
  };

  const relativeAngle = ((qiblaBearing - deviceHeading + 360) % 360);

  return (
    <>
      <AppHeader />
      <main className="max-w-md mx-auto px-4 pb-24">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold mb-1">Qibla Direction</h1>
          <p className="text-neutral-600">Facing the Kaaba in Makkah</p>
        </div>

        {/* Compass */}
        <div className="relative flex justify-center mb-10">
          <div className="relative w-80 h-80">
            <div className="absolute inset-0 border-[18px] border-neutral-200 rounded-full" />

            {["N", "E", "S", "W"].map((dir, i) => (
              <div
                key={dir}
                className="absolute text-2xl font-bold text-neutral-400"
                style={{ transform: `rotate(${i * 90}deg) translateY(-118px)` }}
              >
                {dir}
              </div>
            ))}

            <div
              className="absolute left-1/2 top-1/2 w-2.5 h-40 bg-red-600 rounded-full origin-bottom shadow-2xl transition-transform duration-100"
              style={{ transform: `translate(-50%, -50%) rotate(${relativeAngle}deg)` }}
            >
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 text-5xl">🕋</div>
            </div>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-6xl mb-1">🕋</div>
              <p className="text-xs font-mono text-emerald-700 tracking-widest">MAKKAH</p>
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-3xl px-10 py-6 shadow-lg">
            <p className="text-sm uppercase tracking-widest text-neutral-500 mb-1">QIBLA BEARING</p>
            <p className="text-6xl font-bold font-mono text-emerald-600">{qiblaBearing}°</p>
            <p className="text-sm mt-2">{locationLabel}</p>
          </div>
        </div>

        {compassSupported ? (
          <div className="notice success compact text-center mb-6">✅ Live Compass Active</div>
        ) : (
          <div className="notice neutral compact text-center mb-6">📍 Mathematical Direction</div>
        )}

        <div className="space-y-4 px-1">
          <button
            onClick={requestLocation}
            disabled={isLocating}
            className="button w-full py-4 text-lg"
          >
            {isLocating ? "Getting Location..." : "📍 Use My Current Location"}
          </button>

          <div className="flex gap-3">
            <input
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchPlace()}
              placeholder="Search city or area"
              className="flex-1 px-5 py-4 border rounded-2xl focus:outline-none focus:ring-2"
            />
            <button
              onClick={searchPlace}
              disabled={isSearching || !placeQuery.trim()}
              className="button secondary-button px-8"
            >
              {isSearching ? "..." : "Go"}
            </button>
          </div>

          <Link href="/nearby" className="ghost-button w-full block text-center py-4">
            ← Back to Nearby Masjids
          </Link>
        </div>

        <div className="mt-10 text-center text-sm text-neutral-600 px-4">
          Hold phone flat • Rotate until red needle points to 🕋
        </div>
      </main>
    </>
  );
}