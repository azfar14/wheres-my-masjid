# Reliable Nearby Engine Fix

This package fixes the main reason the app could take a user location but still show no nearby masjids.

## What changed

1. **OSM timeout fix**
   - Previous versions could abort the OpenStreetMap provider before the server route finished.
   - The client timeout is now longer.
   - The OSM route now uses one compact Overpass query and parallel public endpoint attempts, so it returns faster and more reliably.

2. **Mappls India accuracy upgrade**
   - The Mappls provider now searches the official Islamic category code `PLPISL` in addition to keyword searches.
   - It supports these environment variables:
     - `MAPPLS_ACCESS_TOKEN`
     - `MAPPLS_REST_KEY`
     - `MAPPLS_STATIC_KEY`
     - `MAPMYINDIA_ACCESS_TOKEN`
     - `MAPMYINDIA_REST_KEY`
     - `MAPMYINDIA_STATIC_KEY`
     - OAuth client id/secret variants
   - Category results are accepted even if the display name does not literally contain “masjid” or “mosque”.

3. **Better phone location accuracy**
   - The location helper now takes a fresh high-accuracy reading.
   - If it is coarse, it briefly watches for a better GPS sample.
   - The UI warns when browser accuracy is poor.

4. **Location-first behavior remains**
   - Starter Chennai masjids are not shown by default.
   - Results appear only after a location/search center exists.
   - Every result is sorted by distance from the user/search point.

## Critical setup

For India accuracy, Mappls is strongly recommended. Add one of these to `.env.local`:

```env
MAPPLS_ACCESS_TOKEN=your_key_here
```

or:

```env
MAPPLS_STATIC_KEY=your_key_here
```

Then restart:

```powershell
Ctrl + C
npm run dev
```

Test:

```text
/diagnostics
/nearby
```

## Vercel

Add the same provider keys in Vercel project settings as server-side environment variables, then redeploy.

Do not use `NEXT_PUBLIC_` for Mappls or Foursquare keys.
