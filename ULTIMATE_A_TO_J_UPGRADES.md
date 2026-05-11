# Where’s My Masjid — Ultimate A–J upgrade

This build focuses on the A–J improvement pass requested after nearby masjid discovery started working.

## A. Better masjid names and identity

- Added `lib/masjidDisplay.ts` for display-name cleanup.
- Stops showing raw low-quality names like `osm-way-...` and road-like names as if they are masjid names.
- Shows `Masjid near ...` / `Possible masjid near ...` when map data has no reliable public name.
- Adds source labels like `Admin verified`, `Mappls discovery`, `Foursquare discovery`, and `OSM discovery`.

## B. Better homepage

- Homepage is now location-first.
- It shows a real nearest masjid summary card after location search.
- It no longer displays the global data-source demo badge on the nearest card.
- Added premium quick actions: Nearby, Qibla, Saved, Missing.

## C. Better Qibla screen

- Qibla supports a selected masjid/profile pin via URL query params.
- Qibla uses fallback-first UI: location + bearing, live compass if supported, and map-line fallback.
- The large bearing remains usable even when phone compass sensors fail.

## D. Reach-before-jamaat logic

- Cards and profiles show distance/walking time.
- Verified timing cards use reachability advice so users know whether they can reach before jamaat.

## E. Better trust system

- Replaced raw `Trust 40` style with human labels such as `Location discovered`, `Exact name needed`, `Trusted listing`.
- Trust score still exists internally and on detail pages.

## F. Richer masjid detail pages

- Detail page now uses display-cleaned name/locality.
- Shows distance and walking time from the last remembered user location.
- Has Save, Claim, Suggest, exact pin, and Qibla actions.

## G. Better nearby filters

Nearby now includes filters for:

- Verified only
- Has jamaat timings
- Jumu’ah listed
- Ladies area
- Parking
- Wheelchair access
- Saved only

## H. Better missing masjid flow

- Existing exact-pin reporting is retained.
- Users can use current location, extract coordinates from map links, or geocode address.
- Admin can later verify and convert missing reports.

## I. Saved / followed masjids

- Cards provide Save actions.
- `/saved` keeps local snapshots for offline-friendly access.
- Bottom navigation makes Saved easy to reach.

## J. App-ready structure

- Added bottom app navigation.
- Improved touch controls and mobile-first layout.
- Kept provider keys server-side, preserving future Capacitor/native app readiness.

## Accuracy fix included

The OSM parser now rejects road/boundary objects like `Mosque Street` unless they also have strong worship tags. This directly fixes false positives where roads were displayed as masjids.

## Important setup

For best nearby accuracy in India/global use, configure:

```env
MAPPLS_ACCESS_TOKEN=
FOURSQUARE_API_KEY=
NOMINATIM_EMAIL=
```

Phone Qibla/location should be tested on HTTPS deployment, not local LAN URLs.
