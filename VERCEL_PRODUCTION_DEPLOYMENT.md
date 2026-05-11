# Vercel production deployment checklist

## Environment variables

Add these in Vercel → Project → Settings → Environment Variables.

Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Provider keys:

```env
MAPPLS_ACCESS_TOKEN=
MAPPLS_STATIC_KEY=
MAPPLS_REST_KEY=
FOURSQUARE_API_KEY=
NOMINATIM_EMAIL=
```

Do not prefix Mappls/Foursquare keys with `NEXT_PUBLIC_`.

## Deploy

```powershell
npm install
npm run preflight
npm run build
```

Push to GitHub, then import into Vercel.

## After deploy

Test these on the HTTPS Vercel URL:

```text
/diagnostics
/qa
/nearby
/qibla
/admin
/missing
```

Phone Qibla/location should be tested only on HTTPS. Local network URLs like `http://192.168.x.x:3000` are not reliable for browser location/compass APIs.
