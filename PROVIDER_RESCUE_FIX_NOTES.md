# Provider Rescue Fix

This build fixes the problem where Mappls/Foursquare show zero while OSM returns some results.

## What changed

- Foursquare provider now uses the newer `places-api.foursquare.com/places/search` endpoint.
- Foursquare now sends `Authorization: Bearer <service key>` and `X-Places-Api-Version`.
- Foursquare no longer sends legacy `fields=fsq_id...`, because newer Foursquare requests can reject legacy field names.
- Mappls now parses responses safely. Empty/non-JSON Mappls responses show clear diagnostics instead of `Unexpected end of JSON input`.
- The Mappls duplicate key/build issue was removed.
- Broad area searches like `Goa` or `Kerala` no longer rely only on a tiny 2 km centroid search. The app detects broad areas and runs an area rescue search using Nominatim/OSM terms such as mosque, masjid, pallivasal, musalla, and Islamic center.
- Radius options now include 100 km and 150 km for broad region searches. Exact phone-location searches remain strict and distance-sorted.

## Important product rule

For true nearby search, users should use their exact location. Searching a broad region such as `Kerala` is not the same as “near me”; it searches around/inside a broad geographic area and can show candidates sorted from that area center.

## What provider numbers mean

- OSM = 4 means the app has four open-data candidates and should show them if they are inside the chosen radius.
- Mappls = 0 with an empty/non-JSON diagnostic means the key/API access is still not returning usable JSON.
- Foursquare = 0 with quota/auth diagnostic means the Service API Key/project quota is not active for Places API yet.

## After install

Run:

```cmd
npm install
npm run build
npm run dev
```

Then test:

```text
/qa
/nearby
```

For Foursquare, set:

```env
FOURSQUARE_API_KEY=your_service_api_key
```

For Mappls, set one of:

```env
MAPPLS_ACCESS_TOKEN=your_key
MAPPLS_STATIC_KEY=your_key
MAPPLS_REST_KEY=your_key
```

Keep provider keys server-side only. Do not use `NEXT_PUBLIC_` for these provider keys.
