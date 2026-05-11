# Coverage and Navigation Fix — No Paid API Version

This version removes paid Google Places discovery.

## What changed

- No `GOOGLE_MAPS_API_KEY` is needed.
- Google Maps is used only as a no-key external URL for search/directions.
- OpenStreetMap/Overpass is used for open worldwide masjid discovery.
- Nominatim is used for worldwide place search through `/api/place-search`.
- Overpass discovery runs through `/api/osm-masjids` with timeout, cache, and fallback endpoints.
- Unnamed/low-confidence OSM pins are flagged and should not be treated as verified masjids.
- OSM results prefer exact OSM pins/routes so navigation is less likely to jump to a nearby restaurant/shop.

## Correct data model

```text
OpenStreetMap = discovery layer
Firestore = verified truth layer
Community reports = repair layer
Admin/committee claims = scale layer
```

Do not try to manually store every masjid in the world before launch. Use OSM to discover, then convert local verified masjids into Firestore records over time.
