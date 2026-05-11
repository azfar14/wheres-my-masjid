# Where’s My Masjid — Final 300-Crore Ready Build

Read `300_CRORE_READY_HANDOFF.md` first. This build adds optional Google Places discovery, Google Maps start-navigation URLs, Firebase web notification opt-in, cleaner public header, and hides internal Firebase banners from users.

# Where’s My Masjid — Final Deployable Build

A mobile-first Next.js/Firebase/PWA masjid finder.

## What it does

- Takes the user’s location
- Finds nearby masjids through Firestore, Mappls, Foursquare, and OpenStreetMap fallback
- Shows masjids sorted from nearest to farthest
- Shows distance and estimated walking time on every card
- Opens Google Maps directions using exact coordinates
- Shows verified jamaat countdowns only for trusted Firestore listings
- Lets users suggest corrections and report missing masjids
- Includes saved masjids, claim requests, admin review, diagnostics, QA provider lab, and Qibla detector

## No paid Google API required

Google Maps is used only through no-key external URL links for route/navigation. The app does not require Google Places or Google Maps JavaScript API.

## Recommended API setup

Firebase is required for verified listings/admin data. Mappls and Foursquare are optional but strongly recommended for accurate discovery.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
MAPPLS_ACCESS_TOKEN=
FOURSQUARE_API_KEY=
NOMINATIM_EMAIL=
```

Keep Mappls and Foursquare keys server-side. Do not prefix them with `NEXT_PUBLIC_`.

## Run locally

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

## Deploy

Read `FINAL_DEPLOYMENT_GUIDE.md`, then deploy to Vercel.

## Key pages

```text
/diagnostics   setup and phone readiness checks
/qa            provider audit lab for exact coordinates
/nearby        location-first nearby masjid finder
/qibla         Qibla detector and fallback bearing tool
/missing       report a missing masjid exact pin
/admin         manage listings, timings, suggestions, and claims
```

## Build notes

This build includes location-first behavior, strict selected-radius filtering, Google Maps exact-coordinate routing, false-positive OSM road filtering, smart name cleanup, Qibla fallbacks, saved masjids, admin tools, and Vercel-ready configuration.


## Ads / sponsor slots

This version includes respectful sponsor/ad boxes controlled through `NEXT_PUBLIC_SHOW_ADS` and related ad environment variables. See `ADS_MONETIZATION_GUIDE.md`.

## Latest patch: Foursquare + Reach + Network

This package includes the `FOURSQUARE_REACH_SMART_NETWORK_FIX.md` patch notes.

Important: if your manual curl to Foursquare returns `HTTP/1.1 200 OK`, but `/qa` still shows `Foursquare Global = 0`, this version fixes the app-side parsing/rejection issue. The nearby page now also has a `Best for next jamaat` sort mode, reach-before-jamaat guidance on cards, and a `/network` page for the verified-masjid data moat.


## Final Flawless + Powerful Upgrade

This package includes fast provider mode, session caching, clear filter recovery, Google Maps start-navigation links, Foursquare Service API support, reach-before-jamaat logic, smart ranking, and the verified masjid network foundation. Read `FINAL_FLAWLESS_POWER_UPGRADE.md` before deploying.


## Navigation Trust Lock Build

This version prevents unsafe direct navigation from unverified external-provider pins.

- Verified Firestore listings: direct Google Maps navigation.
- Google Place ID listings: Google Maps place navigation.
- Foursquare/Mappls/OSM discoveries: open Google Maps search first so the user selects the real mosque listing before following Directions.
- Admin exact-pin extractor: paste a Google Maps link or coordinates into `/admin` and save verified coordinates.
- `/launch` page: launch-readiness checklist.

Read `NAVIGATION_TRUST_LOCK.md` before inviting public users.

## Masjid Verification + Claim Dashboard

New trust-ops page:

```text
/admin/verification
```

Use this page to verify exact masjid pins, route-test Google navigation, approve claim requests, and assign Firebase Auth users as masjid admins. Direct turn-by-turn navigation is now locked until a masjid has both a trusted verification status and `navigationVerified: true`.

Read:

```text
MASJID_VERIFICATION_CLAIM_DASHBOARD.md
```

## Latest ops upgrade

Added admin analytics, data pipeline tooling, automation scripts, and Qibla accuracy hardening.

New routes:

```text
/admin/analytics
/admin/data-pipeline
```

New scripts:

```text
npm run pipeline:audit -- data/import-example-masjids.json
npm run pipeline:stats
```

Read:

```text
OPS_PIPELINE_ANALYTICS_QIBLA_UPGRADE.md
```
