# Vercel deployment guide

Deploy this project to Vercel so mobile location and Qibla can be tested on an HTTPS link.

## 1. Confirm local build

```powershell
cd C:\Users\Incognito\wheres-my-masjid-location-first-vercel
npm install
npm run build
```

Fix any build errors before deployment.

## 2. Push to GitHub

```powershell
git init
git add .
git commit -m "Location-first masjid finder"
```

Create a GitHub repository, then push:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/wheres-my-masjid.git
git branch -M main
git push -u origin main
```

## 3. Import in Vercel

1. Open Vercel.
2. Click **Add New Project**.
3. Import the GitHub repository.
4. Framework should auto-detect **Next.js**.
5. Add environment variables before deploying.

## 4. Add environment variables in Vercel

Add the same Firebase variables from `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Add optional provider variables:

```env
MAPPLS_ACCESS_TOKEN
MAPPLS_REST_KEY
MAPPLS_STATIC_KEY
MAPPLS_CLIENT_ID
MAPPLS_CLIENT_SECRET
FOURSQUARE_API_KEY
FSQ_API_KEY
NOMINATIM_EMAIL
```

Do not add quotes unless the key itself contains quotes.

## 5. Deploy

Click **Deploy**.

After deployment, open:

```text
https://your-project.vercel.app/diagnostics
```

Run diagnostics, then test:

```text
/nearby
/qibla
/admin
/missing
```

## 6. Firebase authorized domains

If Firebase Authentication refuses login on the deployed site, add the Vercel domain in:

```text
Firebase Console → Authentication → Settings → Authorized domains
```

Add:

```text
your-project.vercel.app
```

## 7. Redeploy after env changes

If you add/change environment variables after deployment, redeploy the project.

## Launch sanity checklist

- `/` does not show starter listings before location.
- `/nearby` waits for location/place search.
- User location returns distance-sorted masjids.
- Mappls provider shows configured in `/diagnostics`.
- Qibla page opens on phone through HTTPS.
- Admin can log in.
- Missing masjid reports save to Firestore.
