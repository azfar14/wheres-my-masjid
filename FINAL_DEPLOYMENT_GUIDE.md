# Where’s My Masjid — Final Deployable Build

This package is the final deployable web/PWA build from the current development cycle.

## Core user promise

A user gives their location, then the app shows nearby masjid listings sorted from nearest to farthest. Every listing shows:

- distance from the user
- estimated walking time
- Google Maps route using exact coordinates
- trust/source label
- jamaat timing status

Verified Firestore masjids can show jamaat countdowns. External listings from Mappls/Foursquare/OSM show timing unknown until verified locally.

## Primary navigation

The main route buttons use Google Maps URLs with exact latitude/longitude:

```text
https://www.google.com/maps/dir/?api=1&origin=USER_LAT,USER_LNG&destination=MASJID_LAT,MASJID_LNG&travelmode=walking
```

No paid Google Maps API key is required for this.

## Required setup

Create `.env.local` from `.env.local.example`.

Minimum Firebase variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Recommended provider variables:

```env
MAPPLS_ACCESS_TOKEN=
FOURSQUARE_API_KEY=
NOMINATIM_EMAIL=
```

Mappls improves India coverage. Foursquare improves global coverage. OSM is always used as fallback.

## Local run

```bash
npm install
npm run preflight
npm run build
npm run dev
```

Open:

```text
http://localhost:3000
```

## Important phone note

Phone location and Qibla compass should be tested on HTTPS, not `http://192.168.x.x:3000`.

Deploy to Vercel, then test:

```text
https://your-project.vercel.app/diagnostics
https://your-project.vercel.app/nearby
https://your-project.vercel.app/qibla
```

## Vercel deploy

1. Push this folder to GitHub.
2. Import it in Vercel.
3. Add all environment variables from `.env.local` in Vercel Project Settings → Environment Variables.
4. Deploy.
5. Test `/diagnostics`, `/qa`, `/nearby`, and `/qibla` on your phone.

## Firebase rules

Publish `firestore.rules` while building. Use `firestore.rules.production` only after setting up admin/owner documents as explained in `MASJID_LEVEL_PERMISSIONS_SETUP.md`.

## Final test checklist

- `/diagnostics` shows Firebase configured.
- `/diagnostics` shows Mappls/Foursquare configured if keys were added.
- `/nearby` waits for location instead of showing random starter masjids.
- `/nearby` shows listings only inside selected radius.
- Nearby listings are sorted nearest first.
- Every nearby card has distance and walking time.
- Every route button opens Google Maps directions.
- `/qibla` works by location, manual coordinates, and place search.
- `/qa` can debug provider counts for your exact location.
- `/missing` can report exact-pin missing masjids.
- `/admin` can verify listings and timings.

## Real-world accuracy rule

The app is engineered to search multiple sources, but no provider can contain every masjid. The long-term winning model is:

```text
External providers discover masjids.
Users report missing pins.
Admins verify exact location and jamaat timings.
Firestore becomes the trusted source.
```

That verified masjid + jamaat data network is the real product moat.
