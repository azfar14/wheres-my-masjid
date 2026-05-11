# Uploaded provider upgrades integrated

This build includes the user-upgraded provider files:

- `lib/providers/foursquare.ts`
- `lib/providers/common.ts`

## Important improvements

- Foursquare now prefers `geocodes.roof` before `geocodes.main` when available, which can reduce shifted building pins.
- Foursquare uses the newer `places-api.foursquare.com/places/search` endpoint with bearer service-key auth and `X-Places-Api-Version`.
- Foursquare no longer rejects valid `200 OK` responses only because rate-limit headers show `0`.
- Dedupe is stricter: nearby pins are no longer merged just because they are close. Names or upstream IDs must match, which avoids mixing two different nearby masjids.
- Provider merging now prioritizes verified Firestore records, then higher-trust provider records.
- Google Directions URL helper is included for exact-coordinate routing where the pin is verified.

## Navigation trust rule

Direct navigation should be used only for verified Firestore/admin-checked masjid pins. External provider pins remain discovery candidates until verified.
