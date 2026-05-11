# Mappls eLoc Nearby Fix

Mappls Nearby can return valid masjid POIs in `suggestedLocations` with fields such as:

- `placeName`
- `placeAddress`
- `distance`
- `eLoc`
- `keywords: ["PLPISL"]`

but without latitude/longitude in the Nearby response.

The app previously dropped those results because it required coordinates. This build accepts those Mappls candidates, stores the eLoc, shows the provider-reported distance, and marks the coordinates as approximate until an exact pin is verified.

## User-facing behavior

- Mappls results now appear when the Nearby API returns `suggestedLocations`.
- Distance uses the Mappls `distance` field when exact coordinates are not returned.
- Navigation remains safe: unverified Mappls candidates open Google/Mappls confirmation first instead of direct routing to a placeholder coordinate.
- Admins can verify the exact pin later, convert it to Firestore truth, and unlock route-tested direct navigation.

## Why this matters

Mappls returned results like `Masjid Noor`, `Masjid Muslimin Jamath`, and `Masjid AL Noor` around Ambattur. The provider was working; the parser was too strict. This build fixes that.
