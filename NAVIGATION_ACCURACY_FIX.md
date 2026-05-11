# Navigation and Location Accuracy Fix

This build fixes the two issues reported after the A-to-J upgrade.

## 1. Duplicate React key warning fixed

The provider health grid now uses a unique provider key made from provider + label + array index. This removes the console warning:

`Encountered two children with the same key, 'Mappls India'`

## 2. Strict nearby radius

The Nearby page no longer silently auto-expands from 5 km to 25/50 km. That auto-expansion made far-away masjids appear and made it feel like the app used the wrong location.

Now:

- User chooses radius.
- App shows only masjids inside that radius.
- Results are sorted nearest first.
- If there are no results, user can manually expand to 10 km / 25 km or open QA.

## 3. Search no longer steals the user's location

If a user already provided location and types `masjid`, `mosque`, `pallivasal`, etc., the app treats it as a filter/search around the current location. It does not geocode the word and jump to a far-away search center.

To change the search center, type an area/city/landmark name such as `Triplicane`, `Makkah`, or `Chennai Central`.

## 4. Google Maps route is now the primary navigation action

Every card now uses Google Maps directions with exact latitude/longitude:

`origin=userLat,userLng` and `destination=masjidLat,masjidLng`

This avoids Google guessing a weak OSM/Mappls name and routing to a restaurant, street, or nearby shop.

## Test checklist

1. Open `/nearby`.
2. Click `Use my location`.
3. Confirm no React key warning appears.
4. Confirm results are only inside the selected radius.
5. Search `masjid` after location is set; it should filter nearby results, not move the center.
6. Click `Google route`; it should open Google Maps directions to exact coordinates.
7. Use `/qa` to debug provider counts if expected masjids are missing.
