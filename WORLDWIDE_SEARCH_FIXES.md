# Worldwide search fixes included

This version fixes the Overpass/OpenStreetMap timeout problem seen during global nearby search.

## What changed

- The expensive OpenStreetMap query was replaced with a smaller, faster query.
- Browser-side OpenStreetMap calls now abort after about 12 seconds instead of leaving the app stuck in `Searching…`.
- Timeout/runtime messages are converted into a friendly notice.
- Saved Firestore listings remain visible while OpenStreetMap search is running or if it times out.
- The Nearby page now supports searching any city, area, address, station, or landmark worldwide.
- A worldwide place search result becomes the search center, then the app looks for masjids around that area.
- OpenStreetMap-discovered masjids can be navigated to, but jamaat timings stay unknown until verified.

## Recommended production architecture

Use this model:

1. OpenStreetMap / geocoder: global masjid discovery and navigation.
2. Firestore: verified masjid profiles and jamaat timings.
3. Suggestions: users submit timing/location corrections.
4. Admin/claim system: masjid committees verify and maintain timings.

This means users anywhere can find a nearby masjid, while the app does not show fake jamaat countdowns for unverified listings.

## Important note

Public OpenStreetMap services are good for MVP testing, but production traffic should use a backend proxy, paid geocoder, or your own hosted OpenStreetMap/Overpass setup to avoid public API limits.
