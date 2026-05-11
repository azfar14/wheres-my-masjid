import type { Coordinates } from "@/types";
import { distanceKm } from "@/lib/geo";

export const KAABA_COORDINATES: Coordinates = {
  lat: 21.4224779,
  lng: 39.8251832
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function calculateQiblaBearing(from: Coordinates): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(KAABA_COORDINATES.lat);
  const deltaLng = toRadians(KAABA_COORDINATES.lng - from.lng);

  const y = Math.sin(deltaLng);
  const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(deltaLng);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

export function qiblaDistanceKm(from: Coordinates): number {
  return distanceKm(from, KAABA_COORDINATES);
}

export function compassDirectionLabel(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return directions[index];
}

export function relativeQiblaArrowRotation(qiblaBearing: number, deviceHeading?: number): number {
  if (typeof deviceHeading !== "number" || !Number.isFinite(deviceHeading)) return qiblaBearing;
  return normalizeDegrees(qiblaBearing - deviceHeading);
}
