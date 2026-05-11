# Operations pipeline + analytics + Qibla accuracy upgrade

## What was added

### Qibla accuracy hardening

The Qibla page now judges three separate things:

1. Mathematical Qibla bearing from the selected/user coordinates
2. Browser/GPS location accuracy
3. Phone compass stability and sensor accuracy

The live arrow is only treated as trustworthy when the location and compass samples are stable. If not, the page tells the user to use the bearing number or map line instead. This avoids false confidence.

Important: no web app can guarantee zero compass error on every phone because phone magnetometers can be affected by metal, chargers, cars, speakers, magnets, browser support, and calibration. This version is safer because it refuses to pretend the live compass is perfect when the phone sensor is not stable.

### Admin analytics engine

New admin route:

```text
/admin/analytics
```

It shows:

- total listings
- admin verified count
- navigation-ready count
- Jumu’ah timing coverage
- external discoveries
- listings needing verification
- city/locality coverage table
- launch warnings
- Chennai pipeline snapshot: 812 found, 203 verified, 97 with Jumu’ah timings

The Chennai numbers are treated as a pipeline snapshot/target, not automatically as verified Firestore truth.

### Data pipeline admin tool

New admin route:

```text
/admin/data-pipeline
```

It lets the admin paste JSON masjid records, validate them, preview errors/warnings, and commit valid records to Firestore. Records imported through the pipeline still need verification before direct navigation is unlocked.

### Automation scripts

Added:

```text
npm run pipeline:audit -- data/import-example-masjids.json
npm run pipeline:stats
```

The audit script checks bulk data files before import. The stats script prints city pipeline snapshot data.

## Performance model

These upgrades do not affect normal public app performance because:

- `/admin/analytics` is admin-only and route-level loaded
- `/admin/data-pipeline` is admin-only and route-level loaded
- scripts run manually in terminal, not during user search
- public `/nearby` still calls providers only after user location/search
- Qibla sensor sampling happens only on `/qibla` after the user taps Enable compass

## Navigation policy remains strict

- Verified + route-tested masjids: direct Start nav
- Google Place ID listings: Google listing route
- External unverified listings: Confirm in Google Maps first

This protects users from shifted provider pins.
