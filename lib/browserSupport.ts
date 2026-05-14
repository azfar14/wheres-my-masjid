export type LocationFailureReason =
  | "unsupported"
  | "insecure"
  | "permission-denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export type CompassFailureReason =
  | "unsupported"
  | "insecure"
  | "permission-denied"
  | "no-heading"
  | "unknown";

export function isBrowserSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
}

export function locationProblemMessage(error?: GeolocationPositionError): { reason: LocationFailureReason; message: string } {
  if (typeof navigator !== "undefined" && !("geolocation" in navigator)) {
    return { reason: "unsupported", message: "This browser does not support location access. Search a city, area, or landmark instead." };
  }

  if (!isBrowserSecureContext()) {
    return {
      reason: "insecure",
      message: "Phone location is blocked on insecure local network links. Open the deployed HTTPS link on your phone, or search a place manually."
    };
  }

  if (!error) return { reason: "unknown", message: "Location could not be read. Search a place manually or try again." };

  if (error.code === error.PERMISSION_DENIED) {
    return { reason: "permission-denied", message: "Location permission was denied. Allow location for this site in your browser settings, or search a place manually." };
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return { reason: "unavailable", message: "Your phone could not get a fresh location. Move near a window, turn on GPS/Wi‑Fi, or search a place manually." };
  }

  if (error.code === error.TIMEOUT) {
    return { reason: "timeout", message: "Location took too long. Try again, use a smaller nearby area search, or search a place manually." };
  }

  return { reason: "unknown", message: error.message || "Location failed. Search a city, area, or landmark instead." };
}

export function compassSupportMessage(): { ok: boolean; message: string } {
  if (typeof window === "undefined") return { ok: false, message: "Compass can only be tested in a browser." };
  if (!isBrowserSecureContext()) {
    return {
      ok: false,
      message: "Phone compass is blocked on insecure local network links. Deploy to HTTPS, then open /qibla on your phone."
    };
  }
  if (!("DeviceOrientationEvent" in window)) {
    return {
      ok: false,
      message: "This browser does not expose compass sensors. Use the true-north Qibla bearing or your phone’s native compass app."
    };
  }
  return { ok: true, message: "Compass API detected. The app will use it only if this phone sends a true-north heading; otherwise it will fall back to the bearing/map line." };
}

export function readableCurrentUrl(): string {
  if (typeof window === "undefined") return "server render";
  return window.location.href;
}
