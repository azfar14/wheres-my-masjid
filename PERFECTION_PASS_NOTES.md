# Where’s My Masjid — Perfection Pass Notes

This version is not a small cosmetic update. It focuses on the biggest risks that could make users leave:

1. inaccurate nearby masjid results,
2. weak OpenStreetMap coverage handling,
3. phone Qibla/location failures,
4. unclear fallback paths when sensors or map data fail.

## What changed

### 1. Stronger global discovery without paid Google APIs

The `/api/osm-masjids` route now uses a layered search:

- strong OpenStreetMap mosque tags,
- name/language fallback tags,
- broad worship safety check for smaller radii,
- bounded Nominatim place searches for terms like mosque, masjid, musalla, pallivasal, and Islamic center,
- server-side caching,
- cleaner diagnostics and coverage grade.

This gives better chances of finding masjids that appear on the OpenStreetMap website but were missed by the previous app query.

### 2. More language and tag coverage

The parser now understands more mosque naming patterns including:

- masjid, mosque, musalla, jumma, jamia,
- pallivasal / pallivaasal,
- surau / musholla / mesjid / mesquita,
- Arabic/Urdu/Hindi/Tamil/Malayalam/Kannada/Telugu/Bengali mosque terms.

It also handles `building=mosque`, `amenity=place_of_worship + religion=muslim`, `building:use=mosque`, `landuse=religious + religion=muslim`, Muslim prayer rooms, and Islamic community centres.

### 3. Exact masjid-name search

The `/nearby` page now accepts exact masjid names, not just city/area names. If the place search returns a masjid-like OSM result, the app immediately adds it as a discovered listing and then searches around it.

### 4. Better phone Qibla page

`/qibla` now has:

- phone readiness panel,
- secure HTTPS warning,
- compass API availability status,
- live heading waiting state,
- fallback mode when the browser does not provide heading samples,
- manual coordinates fallback,
- city/place search fallback,
- true-north bearing copy,
- Google and OSM line links.

The Qibla page now explicitly handles the real mobile-browser problem: phone location and compass generally need HTTPS, and local LAN URLs are often blocked.

### 5. Permissions-Policy headers

`next.config.ts` now sends a Permissions-Policy header for:

- geolocation,
- accelerometer,
- gyroscope,
- magnetometer.

This helps mobile browsers allow the app’s location and orientation features when the site is deployed over HTTPS.

## The product rule

The app should never pretend open map data is perfect. The correct product model is:

- OpenStreetMap/Nominatim = discovery,
- Firestore = verified masjid truth,
- user reports = missing coverage recovery,
- admin/committee claims = long-term data accuracy,
- Qibla and saved masjids = utility that keeps users returning.

## Before public launch

Do these before a public beta:

1. Deploy to HTTPS.
2. Publish the included Firestore rules.
3. Test `/qibla` on at least one Android and one iPhone.
4. Test `/nearby` with your current location at 1 km, 2 km, 5 km, and 10 km.
5. Import/verify the masjids near your own home and office.
6. Ask five real users to report one missing masjid each.
7. Convert reports into Firestore listings and mark only verified timings as admin/community checked.

