# Where’s My Masjid — 300 Crore Ready Handoff

This build focuses on the real launch flow:

**User gives location → nearby masjids appear → nearest first → distance + walking time → Start navigation opens Google Maps turn-by-turn where supported → Qibla works with fallbacks.**

## What was fixed in this build

1. **Google Maps-style mosque results can now be imported through an optional Google Places provider.**
   - Google Maps app results are not freely exposed through no-key URLs.
   - If you want Google Maps POIs such as “Jamia Masjid Mugappair East” to appear inside the app, add `GOOGLE_PLACES_API_KEY`.
   - Google Maps navigation still works without an API key.

2. **Start navigation now uses Google Maps URL parameters with `dir_action=navigate`.**
   - On phones, it lets Google Maps use the phone’s live location rather than a stale browser origin.
   - Some browsers may still show a preview and require the user to tap Start; the website cannot force Google Maps to drive/walk for the user.

3. **Public header is cleaner.**
   - Removed the confusing Diagnostics/QA/Admin icon cluster from the normal user header.
   - Admin remains available at `/admin` for signed-in admins only.

4. **Internal Firebase banners are hidden from normal users.**
   - Users should not see messages like “Firebase connected but no verified masjids.”

5. **Firebase web notification opt-in is added.**
   - New page: `/notifications`.
   - Users can opt in after you add `NEXT_PUBLIC_FIREBASE_VAPID_KEY` and deploy to HTTPS.
   - Tokens are saved in Firestore under `notificationTokens`.
   - Sending scheduled push notifications later requires Firebase Cloud Functions or another trusted backend using the Firebase Admin SDK.

6. **Provider cascade is stronger.**
   - Firestore verified masjids
   - Optional Google Places
   - Mappls / MapmyIndia
   - Foursquare
   - OpenStreetMap fallback
   - Missing masjid exact-pin report

7. **Qibla remains fallback-first.**
   - Location + bearing always works when location works.
   - Compass is used only when the phone/browser supports it.
   - Place search and manual coordinates remain available.

## Required env values

Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Recommended provider keys:

```env
MAPPLS_ACCESS_TOKEN=
FOURSQUARE_API_KEY=
NOMINATIM_EMAIL=
```

Optional Google Maps POI discovery:

```env
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_TEXT_FALLBACK=false
```

Firebase notifications:

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

Sponsor/ad controls:

```env
NEXT_PUBLIC_SHOW_ADS=true
NEXT_PUBLIC_AD_LABEL=Sponsored
NEXT_PUBLIC_AD_HEADLINE=Community sponsor
NEXT_PUBLIC_AD_BODY=A respectful sponsor space that helps keep verified jamaat data free for users.
NEXT_PUBLIC_AD_CTA=Learn more
NEXT_PUBLIC_AD_URL=
```

## Access model

Public users can access:

- `/`
- `/nearby`
- `/qibla`
- `/saved`
- `/missing`
- `/suggest/[id]`
- `/claim`
- `/notifications`

Admins access:

- `/admin`
- `/qa`
- `/diagnostics`

Before a serious public launch, use `firestore.rules.production` and create admin documents so only real admins can manage masjids.

## Final test order

1. `npm install`
2. `npm run preflight`
3. `npm run build`
4. `npm run dev`
5. Open `/diagnostics`
6. Open `/qa` and run your exact coordinates
7. Open `/nearby` → Use my location
8. Confirm nearest results first, distance, walking time
9. Tap **Start nav** and confirm Google Maps opens navigation/route to exact coordinates
10. Open `/qibla` on the Vercel HTTPS phone link
11. Open `/notifications` on HTTPS and test opt-in after adding VAPID key

## Why Google Maps shows some mosques that the app may not show without Google Places

Google Maps POIs are Google’s proprietary Places data. No-key Google Maps URLs can open search/navigation, but they do not return a JSON list of nearby places to your app. To show those same Google results inside your app, use the optional Google Places provider.

## 300-crore product direction

The valuation path is not just “show masjids.” The moat is:

- verified masjid pins
- verified jamaat timings
- Jumu’ah schedules
- Ramadan/Eid schedules
- women-friendly facilities
- admin/committee ownership
- trusted correction history
- saved masjids
- push reminders
- Qibla utility
- high-quality provider cascade
- low-friction Google Maps navigation

