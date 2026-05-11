# Navigation Trust Lock

This build is designed to prevent the most damaging failure: routing a user to the wrong house/building because an external provider returned a shifted POI pin.

## Policy

- `admin_verified` and `community_checked` Firestore listings use direct Google Maps navigation by exact coordinate.
- Google Place ID listings can use Google Maps navigation by place ID.
- Foursquare, Mappls, and OpenStreetMap discovery listings do **not** open direct turn-by-turn navigation to raw provider coordinates.
- External listings open Google Maps search first. The user selects the real mosque listing, then taps Directions inside Google Maps.

## How to make navigation trusted

1. Find the real masjid in Google Maps.
2. Copy the coordinates or a link containing `@lat,lng`.
3. Open `/admin`.
4. Paste the link into `Google Maps link / copied coordinates for exact pin`.
5. Click `Extract exact pin from Maps link`.
6. Save and test `Start nav`.
7. Mark the listing `admin_verified` only after checking the route.

## Why this is necessary

External provider results are useful for discovery but cannot guarantee exact pin accuracy. The app can be unbeatable only if the verified Firestore layer becomes the source of truth for exact pins and jamaat timings.
