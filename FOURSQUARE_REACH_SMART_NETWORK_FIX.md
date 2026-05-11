# Foursquare + Reach Before Jamaat + Smart Network Fix

This build fixes the Foursquare parsing problem confirmed by the user's `200 OK` curl response.

## Foursquare fix

The previous app could receive a valid Foursquare response but still show `0` because it rejected `X-RateLimit-Limit: 0` even when the response body was valid. This build:

- uses `https://places-api.foursquare.com/places/search`
- sends `Authorization: Bearer <FOURSQUARE_API_KEY>`
- sends `X-Places-Api-Version: 2025-06-17`
- does not request invalid legacy fields like `fsq_id`
- accepts `results`, `places`, or nested `data.results` response shapes
- uses `geocodes.main.latitude/longitude` when available
- does not reject valid `200 OK` responses just because `X-RateLimit-Limit` is `0`
- reports diagnostics as `accepted / raw` per query term

## Reach-before-jamaat system

New file:

```text
lib/smartRanking.ts
```

It evaluates each verified masjid against the user's distance and the next jamaat time:

- Reach by walking
- Walk now / tight timing
- Reach by bike/auto
- Likely late
- Timing unknown for unverified external pins

## Smart ranking

Nearby page now has a sort mode:

```text
Nearest first
Best for next jamaat
```

The default still respects the user's earlier requirement: nearest first. The optional smart mode ranks by:

- distance
- trust score
- verified timing availability
- whether the user can reach before next jamaat
- listing quality

## Real masjid network moat

New page:

```text
/network
```

This explains and measures the real value layer:

- verified Firestore masjid pins
- verified jamaat timings
- community checked data
- committee claim flow
- missing-masjid reports
- correction/admin verification loop

This is the acquisition-level moat: verified jamaat intelligence, not just map pins.
