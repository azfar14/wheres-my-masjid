import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env.local");
const requiredFirebase = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];
const mappls = ["MAPPLS_ACCESS_TOKEN", "MAPPLS_REST_KEY", "MAPPLS_STATIC_KEY", "MAPMYINDIA_ACCESS_TOKEN", "MAPMYINDIA_REST_KEY", "MAPMYINDIA_STATIC_KEY", "MAPPLS_CLIENT_ID", "MAPMYINDIA_CLIENT_ID"];
const foursquare = ["FOURSQUARE_API_KEY", "FSQ_API_KEY"];
const googlePlaces = ["GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY"];

function parseEnv() {
  if (!existsSync(envPath)) return {};
  const text = readFileSync(envPath, "utf8");
  return Object.fromEntries(
    text.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).trim()];
      })
  );
}

const env = parseEnv();
const missingFirebase = requiredFirebase.filter((key) => !env[key]);
const hasMappls = mappls.some((key) => env[key]);
const hasFoursquare = foursquare.some((key) => env[key]);
const hasGooglePlaces = googlePlaces.some((key) => env[key]);

console.log("Where's My Masjid preflight");
console.log("-----------------------------");
console.log(existsSync(envPath) ? ".env.local found" : ".env.local missing");
console.log(missingFirebase.length ? `Firebase missing: ${missingFirebase.join(", ")}` : "Firebase config: ready");
console.log(hasGooglePlaces ? "Google Places provider: configured" : "Google Places provider: optional/not configured");
console.log(hasMappls ? "Mappls India provider: configured" : "Mappls India provider: not configured yet");
console.log(hasFoursquare ? "Foursquare global provider: configured" : "Foursquare global provider: not configured yet");
console.log(env.NOMINATIM_EMAIL ? "Nominatim email: set" : "Nominatim email: optional but recommended before public traffic");
console.log(env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? "Firebase web push VAPID key: set" : "Firebase web push VAPID key: optional until notifications are launched");

if (missingFirebase.length) {
  console.log("\nFix Firebase env values before deployment. External providers are optional, but Firebase is required for verified masjid/timing data.");
  process.exitCode = 1;
} else {
  console.log("\nPreflight passed. Run npm run build, then deploy to Vercel.");
}
