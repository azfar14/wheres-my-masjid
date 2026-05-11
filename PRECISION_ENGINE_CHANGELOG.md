# Precision Engine Changelog

## Goal

Make Where's My Masjid reliable enough that users do not leave after one bad result.

## What changed

- Added Mappls/MapmyIndia provider layer for India-first masjid/POI discovery.
- Added Foursquare Places provider layer for global POI discovery.
- Kept OpenStreetMap/Overpass as fallback, not the only source.
- Added `/api/providers/health` and `/diagnostics` so provider setup, location and compass issues can be checked before users experience them.
- Fixed Foursquare authentication to use the API key in the `Authorization` header.
- Added Mappls static-key and OAuth-style fallback support.
- Added high-accuracy plus relaxed browser geolocation fallback.
- Added automatic radius expansion on location search: 5 km → 10 km → 25 km when coverage is thin.
- Homepage now searches up to 25 km if needed and shows loaded nearby masjids with distances.
- `/nearby` always distance-sorts results from the user/search center and displays distance + walking estimate on every card.
- Qibla now auto-loads saved location when available and keeps working through place search/manual coordinates even when sensors fail.

## Important launch rule

A browser-based Qibla compass and phone geolocation still require HTTPS for reliable testing. Deploy to Vercel or another HTTPS host, then test on phone through `/diagnostics` and `/qibla`.

## Business moat

The provider cascade helps discovery, but the app's long-term value comes from Firestore verified data:

- exact masjid pins,
- verified jamaat timings,
- Jumu'ah timings,
- facilities,
- committee/admin ownership,
- correction history,
- missing-masjid recovery,
- trusted local volunteers.

No map provider alone gives this jamaat intelligence.
