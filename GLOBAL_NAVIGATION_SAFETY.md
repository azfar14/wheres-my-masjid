# Global Navigation Safety System

This build is designed for worldwide masjid discovery without pretending that every provider pin is perfect.

## Core rule

**Direct turn-by-turn navigation is allowed only when the destination is route-safe.**

Route-safe means one of these:

1. `verificationStatus` is `admin_verified` or `community_checked`, and `navigationVerified` is `true`.
2. The result has a `googlePlaceId`, so Google Maps can resolve the actual listing.

Everything else is treated as an external discovery lead and opens **Confirm in Maps** instead of direct coordinate routing.

## Why this matters

Foursquare, Mappls, OpenStreetMap, and other providers can return useful names but shifted coordinates. If the app blindly launches navigation to those coordinates, users can be sent to a house/shop near the mosque instead of the real masjid.

The user-facing behavior is now:

- Verified masjid: **Start nav**
- Google Place ID listing: **Start nav**
- Foursquare/Mappls/OSM unverified listing: **Confirm in Maps**

## Worldwide model

The app can discover masjids worldwide through providers, but the trusted navigation layer is separate:

- Discovery: Firestore + Foursquare + Mappls + Google Places optional + OSM
- Direct navigation: verified Firestore pins or Google Place IDs
- Confirmation navigation: Google Maps search for unverified provider results
- Trust growth: users/admins verify exact pin and enable `navigationVerified`

This is the safest practical way to support worldwide use without manually entering every masjid.
