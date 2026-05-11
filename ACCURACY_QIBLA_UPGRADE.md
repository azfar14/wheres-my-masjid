# Accuracy + Qibla Upgrade

This version focuses on three issues:

1. Admin permission errors.
2. Nearby masjid accuracy when OpenStreetMap has a masjid but the app did not show it.
3. A much better Qibla detector interface.

## Required after installing

Publish the included `firestore.rules` file:

Firebase Console → Firestore Database → Rules → paste `firestore.rules` → Publish.

This fixes the admin message: `Missing or insufficient permissions`.

## Masjid discovery improvements

The app now uses a wider no-paid-API discovery stack:

- Firestore verified masjids.
- OpenStreetMap Overpass strong-tag search.
- OpenStreetMap Overpass name fallback search.
- OSM/Nominatim bounded mosque place search.
- Exact OpenStreetMap node/way/relation link import.
- Missing masjid report with exact coordinates.

If you can find a mosque on the OpenStreetMap website but the nearby search misses it, copy the OpenStreetMap object link and paste it into `/nearby` under **Found it on OpenStreetMap?**.

Example formats:

```text
https://www.openstreetmap.org/way/123456789
https://www.openstreetmap.org/node/123456789
way 123456789
node 123456789
```

The app will import the OSM object into local discovery so you can open it, suggest corrections, and later create a verified Firestore listing from admin.

## Qibla improvements

The Qibla detector now includes:

- Large bearing readout.
- Compass mode and true-north fallback mode.
- Turn-left / turn-right instructions.
- Sensor accuracy message.
- Copy bearing button.
- Place search for Qibla direction.
- Calibration tips.

Phone compass sensors can drift. The app warns users to keep the phone flat and away from metal, chargers, speakers, and vehicles.
