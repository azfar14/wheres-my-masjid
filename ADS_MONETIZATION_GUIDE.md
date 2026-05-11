# Ads / Sponsor Slots

This build includes respectful, non-intrusive ad slots for early monetization without disturbing the prayer flow.

## Where ads appear

- Home page: after the nearest masjid card.
- Nearby page: after the third nearby listing.
- Masjid profile: below the distance/reach section, before detailed timings.
- Saved page: one compact sponsor slot.

No ad is placed inside the Qibla compass interface or above the main nearby result.

## Environment variables

```env
NEXT_PUBLIC_SHOW_ADS=true
NEXT_PUBLIC_AD_LABEL=Sponsored
NEXT_PUBLIC_AD_HEADLINE=Community sponsor
NEXT_PUBLIC_AD_BODY=A respectful sponsor space that helps keep verified jamaat data free for users.
NEXT_PUBLIC_AD_CTA=Learn more
NEXT_PUBLIC_AD_URL=https://example.com
```

To hide all ad boxes:

```env
NEXT_PUBLIC_SHOW_ADS=false
```

## Recommended monetization style

Start with direct community sponsorships rather than aggressive ad networks. Good sponsors could include halal restaurants, Islamic bookstores, local services, Ramadan/Eid community events, or businesses that are appropriate for the audience.

Avoid intrusive ads around prayer, Qibla, jamaat timing, or emergency navigation actions. Keep ads clearly labelled as sponsored content.

## Future upgrade

Later you can replace the placeholder content in `components/AdSlot.tsx` with a real ad provider script or a Firestore-powered sponsor campaign system.
