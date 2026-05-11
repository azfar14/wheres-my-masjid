import type { Coordinates } from "@/types";

export type BrowserLocationResult = {
  coordinates: Coordinates;
  accuracyMeters?: number;
  source: "high-accuracy" | "relaxed" | "watch-best";
};

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function watchBestPosition(maxWaitMs = 9000): Promise<GeolocationPosition | undefined> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(undefined);
      return;
    }

    let best: GeolocationPosition | undefined;
    let settled = false;

    const finish = (watchId?: number) => {
      if (settled) return;
      settled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      resolve(best);
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = Number(position.coords.accuracy || Number.POSITIVE_INFINITY);
        const bestAccuracy = Number(best?.coords.accuracy || Number.POSITIVE_INFINITY);
        if (!best || accuracy < bestAccuracy) best = position;

        // A sub-80m browser reading is generally good enough for nearby masjid search.
        if (accuracy <= 80) finish(watchId);
      },
      () => finish(watchId),
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
    );

    window.setTimeout(() => finish(watchId), maxWaitMs + 500);
  });
}

function resultFrom(position: GeolocationPosition, source: BrowserLocationResult["source"]): BrowserLocationResult {
  return {
    coordinates: { lat: position.coords.latitude, lng: position.coords.longitude },
    accuracyMeters: position.coords.accuracy,
    source,
  };
}

export async function getBestBrowserLocation(): Promise<BrowserLocationResult> {
  let firstError: unknown;

  // First try a fresh high-accuracy single reading. This is fast when GPS is ready.
  try {
    const position = await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    if (!position.coords.accuracy || position.coords.accuracy <= 150) return resultFrom(position, "high-accuracy");

    // If the first reading is coarse, watch briefly and take the best sample.
    const watched = await watchBestPosition(8500);
    if (watched && (!watched.coords.accuracy || watched.coords.accuracy < position.coords.accuracy)) {
      return resultFrom(watched, "watch-best");
    }
    return resultFrom(position, "high-accuracy");
  } catch (error) {
    firstError = error;
  }

  // If high accuracy fails, fall back to a cached/relaxed reading so the user can still search.
  try {
    const position = await getPosition({ enableHighAccuracy: false, timeout: 16000, maximumAge: 300000 });
    return resultFrom(position, "relaxed");
  } catch (error) {
    throw error || firstError;
  }
}

export function accuracyText(result: BrowserLocationResult): string {
  const accuracy = result.accuracyMeters ? ` · accuracy ${Math.round(result.accuracyMeters)} m` : "";
  if (result.source === "watch-best") return `Best phone location sample ready${accuracy}`;
  return result.source === "high-accuracy" ? `High-accuracy location ready${accuracy}` : `Location fallback ready${accuracy}`;
}

export function accuracyWarning(result: BrowserLocationResult): string | undefined {
  const accuracy = result.accuracyMeters ?? 0;
  if (!accuracy) return undefined;
  if (accuracy > 1000) return `Your browser location is very coarse (${Math.round(accuracy)} m). Nearby results may miss close masjids. Turn on GPS/Wi-Fi or search your street/area.`;
  if (accuracy > 300) return `Your browser location accuracy is ${Math.round(accuracy)} m. Results are sorted from that approximate point.`;
  return undefined;
}
