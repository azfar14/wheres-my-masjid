# Global Nearby Upgrade Notes

This version fixes the duplicate homepage card and adds global nearby discovery.

## What changed

1. **No duplicate homepage cards**
   - The first card is now the highlighted nearest/best masjid.
   - The list below is now `More nearby options`, so the same masjid is not repeated immediately below.

2. **Global masjid discovery**
   - When a user allows location, the app searches OpenStreetMap through the Overpass API around the user.
   - This lets users outside the starter city find nearby masjids/prayer places without waiting for every masjid to be manually added to Firestore.

3. **Verified timings are separated from discovered listings**
   - Firestore/admin verified masjids can show jamaat countdowns.
   - OpenStreetMap-discovered listings show navigation and address details, but their jamaat timings are marked unknown until verified.

4. **Public demo cleanup**
   - Public pages hide old `demo-*` records when real Firestore listings exist.
   - Admin still sees legacy demo records so they can be removed from Firestore.

5. **Suggestion snapshots for discovered masjids**
   - If a user suggests an update for an OpenStreetMap-discovered masjid, the suggestion stores a snapshot of that masjid.
   - Admin can create a Firestore listing from that suggestion and then verify the jamaat timings.

## Important limitations

OpenStreetMap can help discover nearby masjids globally, but it normally does **not** contain real jamaat timings. The app should not show a jamaat countdown for discovered listings until a masjid admin or trusted community member verifies timings.

For production scale, consider moving OpenStreetMap/Overpass searches to your own backend or a paid map/geocoding provider to improve reliability and rate-limit handling.
