# Legendary Upgrade Plan

This build is designed around a serious acquisition-style product direction: create a verified masjid data network, not just a website.

## Already included in this package

- No paid Google Places dependency.
- Worldwide place search through a server-side Nominatim proxy.
- Nearby masjid discovery through a server-side OpenStreetMap/Overpass proxy.
- Overpass fallback endpoints, timeout handling, and response caching.
- Exact-coordinate navigation links.
- Missing masjid report with exact pin tools.
- Admin suggestion review.
- Admin create-listing-from-report flow.
- Masjid claim request flow.
- Qibla detector with optional compass.
- Saved masjids on device.
- Trust score and reachability advice.
- Basic PWA service worker.
- Admin product control center.

## North-star user flow

```text
User opens app → finds reachable jamaat → reaches masjid on time
```

## High-value upgrades to build next

1. **Masjid-level permissions**
   - `/admins/{uid}` with role and allowed masjid IDs.
   - Firestore rules that prevent admins editing other masjids.

2. **Audit trail**
   - Who changed timing, when, old value, new value, proof source.
   - Public “last verified” confidence.

3. **Ramadan mode**
   - Iftar, suhoor, taraweeh, qiyam, Eid prayer.
   - Ramadan timetable import.

4. **Leave-now alerts**
   - “Leave in 4 minutes to reach Asr jamaat.”
   - Web notifications first, native app later.

5. **Bulk city onboarding**
   - CSV/JSON import for volunteers.
   - City leader dashboard.
   - Duplicate detection and verification queue.

6. **Masjid committee dashboard**
   - Simple daily timing update.
   - Ramadan timetable import.
   - Jumu’ah crowd/facilities updates.

7. **Scale-ready OSM infrastructure**
   - Cache Nominatim/Overpass responses.
   - Add self-hosted or commercial OSM services when traffic grows.

8. **Native app path**
   - PWA → Capacitor Android wrapper → native app if traction is strong.

## Acquisition-level moat

The moat is verified, local, time-sensitive religious infrastructure data:

```text
Masjid + exact pin + jamaat time + verifier + freshness + committee ownership
```
