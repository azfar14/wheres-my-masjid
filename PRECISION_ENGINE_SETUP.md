# Where's My Masjid Precision Engine Setup

This version is built to avoid the OSM-only accuracy problem.

## Provider order

1. Firestore verified masjids: trusted jamaat data.
2. Mappls / MapmyIndia: India-first nearby POI discovery.
3. Foursquare Places: worldwide POI discovery.
4. OpenStreetMap / Overpass: open fallback discovery.
5. User missing-masjid reports: exact pin recovery.

Every result is distance-sorted from the chosen location. Verified timings are shown only for Firestore/community-checked records. External provider listings show location/distance/navigation, but timing remains unknown until verified.

## Environment variables

Copy `.env.local.example` to `.env.local`, keep your Firebase values, then add optional provider keys.

### Mappls / MapmyIndia

Use one of these:

```env
MAPPLS_ACCESS_TOKEN=your_static_rest_key_or_access_token
```

or OAuth credentials:

```env
MAPPLS_CLIENT_ID=your_client_id
MAPPLS_CLIENT_SECRET=your_client_secret
```

For India coverage, Mappls should be turned on before you share the app publicly. Keep Mappls attribution/source labels visible when displaying Mappls results.

### Foursquare

```env
FOURSQUARE_API_KEY=your_foursquare_places_api_key
```

The server route sends this key through the Authorization header. Do not prefix it with `NEXT_PUBLIC_`.

### Nominatim

```env
NOMINATIM_EMAIL=your_contact_email@example.com
```

This helps with responsible OSM/Nominatim use.

## Phone testing rule

For location and Qibla compass on phones, deploy the site to HTTPS first. Do not rely on `http://192.168.x.x:3000` for phone testing because browsers block or degrade location/compass APIs on insecure pages.

Use:

```text
/diagnostics
```

before sharing the app. It checks provider configuration, location, compass, and current URL security.

## Nearby search behavior

When a user taps location:

1. The app gets high-accuracy location first.
2. If that fails, it tries a relaxed location fallback.
3. It searches provider layers.
4. If coverage is thin, it auto-widens the radius up to 25 km.
5. It lists every loaded masjid with exact distance from the user.
6. If results are still missing, users can search a place, paste an OSM object link, or report an exact pin.

## Qibla behavior

Qibla does not depend only on compass sensors.

The Qibla page supports:

- phone location,
- saved location,
- place search,
- manual coordinates,
- true-north Qibla bearing,
- live compass only when the browser supports it,
- map line fallback.

If the live arrow fails, the bearing number remains usable.
