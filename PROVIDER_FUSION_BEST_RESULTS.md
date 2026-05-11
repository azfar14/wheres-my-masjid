# Provider Fusion Best Results Upgrade

This build changes nearby discovery from a single-provider mindset to provider fusion.

## What it does

- Google Places, Mappls, and Foursquare are all queried in parallel.
- A strong Foursquare response does not suppress Mappls.
- A strong Mappls response does not suppress Foursquare.
- Common listings are merged/deduped using provider IDs, strong name similarity, and coordinate closeness.
- Slow OSM/Overpass is time-boxed so it can add extra open-data results when it is fast, but it does not make users wait 20+ seconds.
- Diagnostics now explicitly say when provider fusion was used.

## Why

The best nearby result list should combine the strongest available provider data:

- Firestore = verified truth and jamaat timings
- Google Places = optional Google-grade place discovery
- Mappls = India-first POI discovery when configured
- Foursquare = global POI discovery
- OSM/Overpass = open-data fallback

The public list should show each real masjid once, even if more than one provider finds it.

## Expected QA output

On `/qa`, you should see separate counts such as:

- Mappls India: X found
- Foursquare Global: X found
- OpenStreetMap / Overpass: included if quick, otherwise time-boxed
- Final candidates: deduped result count

If Mappls still shows `0 found`, that means Mappls itself is returning no usable data for that coordinate/key. It is still being queried; it is not ignored.
