# Where Is My Masjid — Final provider/navigation upgrade pack

Drop these files into the project root and overwrite the existing files:

```txt
lib/providers/common.ts
lib/providers/foursquare.ts
lib/providers/googlePlaces.ts
lib/providers/mappls.ts
lib/navigationTrust.ts
```

## What this pack fixes

1. **Mixed-up names/addresses**
   - Removes the old distance-only duplicate merge.
   - Listings only merge when IDs match or the names are similar and the coordinates are close.

2. **Wrong navigation**
   - Adds `lib/navigationTrust.ts`.
   - Verified Firestore pins use direct Google Maps route by exact coordinates.
   - Google Place ID listings use Google Place ID routing.
   - Unverified Foursquare, Mappls, and OSM listings open Google Maps search first instead of raw turn-by-turn navigation.

3. **Foursquare accuracy**
   - Prefers roof/building coordinates before main coordinates.
   - Filters results strictly inside the chosen radius.

4. **Mappls stability**
   - Treats 204/empty nearby responses as zero results, not a cascade-breaking error.
   - Adds extra key env aliases.
   - Filters results strictly inside the chosen radius.
   - Changes the note so it does not overpromise direct navigation accuracy.

5. **Google Places consistency**
   - Keeps Google Place ID for safer routing.
   - Converts provider confidence to the same 0–100 style used by the other providers.

6. **React duplicate key warning**
   - `lib/providerHealthGridKey.ts` gives a ready helper for provider health cards.

## UI wiring needed

In your masjid card/list component, replace the current navigation URL with:

```tsx
import { getMasjidNavigationAction } from "@/lib/navigationTrust";

const action = getMasjidNavigationAction(masjid, userLocation);

<a
  href={action.href}
  target="_blank"
  rel="noopener noreferrer"
  title={action.helperText}
>
  {action.label}
</a>
```

Make sure list rendering uses the real masjid ID, not array index:

```tsx
{masjids.map((masjid) => (
  <MasjidCard key={masjid.id} masjid={masjid} />
))}
```

For provider health cards, use a unique key like this:

```tsx
import { providerHealthGridKey } from "@/lib/providerHealthGridKey";

{providers.map((provider, index) => (
  <ProviderHealthCard key={providerHealthGridKey(provider, index)} provider={provider} />
))}
```

## After installing

Run:

```bash
npm run dev
```

Then test:

1. Open `/nearby`.
2. Click **Use my location**.
3. Confirm results are inside the selected radius.
4. Confirm Foursquare/Mappls/OSM unverified results say **Check in Google Maps**.
5. Confirm admin/community verified results say **Start nav**.
6. Confirm Google Place ID results say **Google route**.
