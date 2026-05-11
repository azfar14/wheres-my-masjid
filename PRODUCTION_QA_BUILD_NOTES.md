# Where’s My Masjid — Production QA Build

This build is designed to fix the real launch risk: a user gives location, but the app does not explain why nearby masjids are missing.

## New pages

### `/qa`
Production QA lab. Enter a latitude/longitude or tap **Use my location**, then run provider audit.

It shows:

- Mappls configured/result count/errors
- Foursquare configured/result count/errors
- OpenStreetMap/Overpass/Nominatim result count/errors
- final accepted candidates sorted by distance
- why each result was accepted
- launch readiness for that exact coordinate
- next actions when results are thin

### `/diagnostics`
Still checks browser HTTPS/location/compass/provider configuration, with a link to `/qa`.

## Location-first behavior

The public app no longer shows starter masjids by default. It waits for location or searched place. After location is available, each masjid card shows:

- distance from user
- walking time estimate
- source/provider
- trust score
- verified/unknown timing state

Verified Firestore listings are the source of truth for jamaat timings. External providers are for discovery only.

## Provider cascade

The nearby engine uses:

1. Firestore verified listings
2. Mappls for India-first discovery
3. Foursquare for global discovery
4. OpenStreetMap as fallback
5. exact-pin missing masjid reports

For India, configure Mappls. For global coverage, configure Foursquare.

## No silent failure

If nearby results are thin, `/nearby` now displays a search report and links to `/qa` with the exact coordinate/radius so you can debug that specific failure.

## Qibla upgrade

The Qibla page is now fallback-first:

- location + true-north bearing
- live compass when browser supports it
- map line to Kaaba
- place search fallback
- manual coordinate fallback

Phone location and compass should be tested through a deployed HTTPS URL, not a local LAN URL.

## Admin and audit foundation

Admin actions now write non-blocking audit logs to `auditLogs` when possible. If audit logging fails due to rules, the primary admin action still succeeds.

Included files:

- `firestore.rules` — MVP-friendly rules that avoid permission trouble during development.
- `firestore.rules.production` — stricter masjid-level permission foundation for a serious launch.

Use production rules only after you create an owner admin document in Firestore.

## Launch gate

Before sharing a city publicly:

1. Deploy to Vercel HTTPS.
2. Configure Firebase, Mappls, and Foursquare environment variables.
3. Run `/diagnostics` on desktop and phone.
4. Run `/qa` on at least 10 real test coordinates.
5. Make sure the most important local masjids exist as verified Firestore listings.
6. Check `/nearby` with 1 km, 2 km, 5 km, and 10 km radii.
7. Verify Qibla on phone through HTTPS.

No free third-party map source contains every masjid perfectly. The long-term moat is your verified Firestore masjid + jamaat database.
