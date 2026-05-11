# Admin verification layout fix

This build fixes the cramped `/admin/verification` screen.

## What changed

- The admin verification page now widens the app shell on desktop/tablet admin screens.
- The verification form and verification queue no longer fight inside a 480px mobile shell.
- If there are no real masjid listings, the page now shows a clean empty state instead of rendering a half-empty checklist form.
- Demo listings remain hidden from the queue, and the page points admins to `/nearby`, `/admin`, and `/admin/data-pipeline` to create real listings.
- The queue panel becomes sticky only when there is enough screen width.
- Mobile and narrow screens stack the queue and form vertically.

## Qibla accuracy reminder

The Qibla bearing calculation is mathematical, but a live phone compass depends on the phone sensor and browser support. Test `/qibla` on the deployed HTTPS Vercel link. If the compass sensor is unstable, the page should guide the user to use the bearing number or map line fallback.

## Run checks

```cmd
npm run syntax-check
npm run build
npm run dev
```

Then open:

```text
/admin/verification
/admin/analytics
/admin/data-pipeline
/qibla
/nearby
```
