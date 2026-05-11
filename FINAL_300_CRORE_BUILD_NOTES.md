# Where's My Masjid — Final Precision Build Notes

This package is designed as the strongest current web/PWA foundation for the product:

- location-first nearby masjid search
- distance sorted cards from the user's exact location
- Mappls/MapmyIndia India provider layer
- Foursquare global provider layer
- OpenStreetMap/Overpass fallback
- Firestore verified masjid + verified jamaat timing database
- missing masjid exact-pin reports
- claim requests for masjid committees
- Qibla detector with compass + sensorless fallbacks
- saved masjids
- admin correction review
- PWA shell cache
- Vercel deployment readiness
- app-conversion readiness later

## The product rule

The app must never pretend unverified external provider timings are real jamaat timings.

Provider results show:

- distance
- walking time
- source
- exact pin/navigation
- timing unknown / verify status

Only Firestore records with `admin_verified` or `community_checked` show jamaat countdowns.

## The nearby guarantee inside the app

When a user provides location, the app:

1. gets the best browser location sample available,
2. searches Firestore verified listings,
3. searches Mappls when configured and the user is in India/nearby region,
4. searches Foursquare when configured,
5. searches OpenStreetMap fallback,
6. merges duplicates,
7. filters by radius,
8. sorts by distance from the user,
9. shows distance and estimated walking time on every card.

No free/premium provider can guarantee every masjid already exists in their map data. That is why the missing-masjid flow is part of the core product: report exact pin → admin verifies → Firestore becomes the trusted result.

## Phone Qibla and location

For phone testing, use HTTPS. Browser APIs for phone location and compass are restricted on insecure local network URLs.

Use Vercel deployment before final phone testing:

- `/nearby`
- `/qibla`
- `/diagnostics`

## Required before public beta

- Publish `firestore.rules` in Firebase.
- Add all Firebase env variables in Vercel.
- Add Mappls key for India coverage.
- Add Foursquare key for global coverage.
- Run `/diagnostics` on the deployed HTTPS link.
- Remove old starter/demo listings from `/admin`.
- Verify at least 20 masjids in your launch locality.

## App conversion later

The current frontend is built as a mobile-first web/PWA. Convert later using Capacitor or rebuild as React Native/Flutter while keeping the same Firestore backend and provider API routes.
