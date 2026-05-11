# Final Deployment Checklist

## 1. Local setup

```powershell
cd C:\Users\Incognito\wheres-my-masjid-final-precision
copy .env.local.example .env.local
notepad .env.local
npm install
npm run preflight
npm run build
npm run dev
```

Open:

```text
http://localhost:3000/diagnostics
```

## 2. Required Firebase environment variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## 3. Strong provider variables

India:

```env
MAPPLS_ACCESS_TOKEN=
```

Global:

```env
FOURSQUARE_API_KEY=
```

Optional but recommended:

```env
NOMINATIM_EMAIL=
```

## 4. Vercel

Push to GitHub, import the repository into Vercel, add the same environment variables, then deploy.

After changing env variables in Vercel, redeploy.

## 5. Phone test only on HTTPS

Test these on the Vercel HTTPS URL:

```text
/diagnostics
/nearby
/qibla
/admin
/missing
```

## 6. Launch acceptance test

The app is ready for private beta only when this flow works:

1. user opens `/nearby`,
2. taps Use my location,
3. nearby masjids appear sorted nearest first,
4. each card shows distance and walking time,
5. unverified provider results show timing unknown,
6. verified Firestore results show jamaat countdowns,
7. Qibla works through location + bearing fallback,
8. missing masjid report saves to Firestore,
9. admin can verify or create listing.
