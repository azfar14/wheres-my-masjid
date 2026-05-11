# Location-first verification upgrade

This version fixes the issue where the five starter Chennai masjids appeared before the user gave a location.

## What changed

- Home page no longer shows Firestore/starter listings by default.
- Nearby page no longer shows the full Firestore list by default.
- After the user taps **Use my location** or searches a place, every visible masjid is filtered by the selected radius.
- Results are sorted primarily by actual distance from the user, not by trust/source.
- Firestore verified masjids still appear, but only if they are inside the search radius.
- Mappls/Foursquare/OSM results are merged and deduplicated.
- Admin has a **Remove Chennai starter listings** button.
- Mappls now accepts `MAPPLS_STATIC_KEY` in addition to `MAPPLS_ACCESS_TOKEN` and `MAPPLS_REST_KEY`.

## First admin action

After running this version, open `/admin`, log in, and click:

```text
Remove Chennai starter listings
```

This is optional for public display because the public pages are now location-first, but it cleans the database.

## User flow to verify

1. Open `/`.
2. Confirm no Chennai starter masjid card appears before location.
3. Tap **Find nearby**.
4. Confirm results show distance from your actual location.
5. Open `/nearby`.
6. Confirm no Firestore list appears before location.
7. Tap **Use my location**.
8. Confirm every visible masjid is within the selected radius and sorted by distance.
9. Change radius from 1 km to 2 km, 5 km, 10 km, 25 km.
10. Confirm the list updates by distance.

## Provider setup

For better India coverage, configure Mappls:

```env
MAPPLS_ACCESS_TOKEN=your_key
```

or:

```env
MAPPLS_STATIC_KEY=your_key
```

For stronger worldwide coverage, configure Foursquare:

```env
FOURSQUARE_API_KEY=your_key
```

Keep provider keys server-side only. Do not prefix them with `NEXT_PUBLIC_`.
