# Where’s My Masjid — Final Flawless + Powerful Upgrade

This build focuses on the real launch problem: nearby masjids must appear quickly and reliably after the user gives a location.

## What changed

### 1. Fast provider mode
If Google/Mappls/Foursquare return enough nearby candidates, the app no longer waits for slow OpenStreetMap/Overpass. This fixes 20+ second searches where Foursquare already found enough masjids in about one second.

### 2. Session cache
Nearby discovery results are cached in the browser for a short period. Repeating the same nearby search feels instant and avoids provider overuse.

### 3. Foursquare working path preserved
The app uses the new Foursquare Places endpoint with Service API Key bearer auth and the version header. It does not reject valid 200 OK responses just because Foursquare sends `X-RateLimit-Limit: 0`.

### 4. Clear filter recovery
If users accidentally turn on filters that hide results, the nearby page shows a clear “Clear all filters” recovery action.

### 5. User-first navigation
Every masjid card uses Google Maps direction URLs with exact coordinates and `dir_action=navigate`, so users can open normal Google Maps navigation without a paid Google Maps API key.

### 6. Smart ranking + reach-before-jamaat
The app keeps nearest-first as default, but supports “Best for next jamaat” ranking. Verified masjids can show whether the user can reach before jamaat by walking or auto/bike.

### 7. Trust moat remains intact
External providers discover pins. Firestore remains the trusted network for verified jamaat timings, Jumu’ah, facilities, khutbah language, committee claims, and correction history.

## Required test checklist

1. `npm install`
2. `npm run build`
3. `npm run dev`
4. Open `/qa`, use location, confirm Foursquare returns results.
5. Open `/nearby`, use location, confirm masjids appear nearest-first.
6. Click **Start nav** on a masjid card, confirm Google Maps opens directions.
7. Deploy to Vercel and test `/qibla` on HTTPS phone link.

## Important

No API can guarantee every masjid in the world unless the data source contains it. The reliable long-term product is:

Firestore verified masjids + Foursquare/Mappls/OSM discovery + missing masjid reports + admin verification.
