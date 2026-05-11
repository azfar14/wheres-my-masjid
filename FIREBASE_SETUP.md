# Firebase setup for Where’s My Masjid

This version is Firebase-ready. It still shows demo masjids when Firebase is not configured, so the site will not break while you set things up.

## 1. Create a Firebase project

1. Open Firebase Console.
2. Create a new project.
3. Add a Web app.
4. Copy the Firebase config values.

## 2. Add local environment variables

Copy the example file:

```bash
copy .env.local.example .env.local
```

On macOS/Linux:

```bash
cp .env.local.example .env.local
```

Paste your Firebase Web config values into `.env.local`.

## 3. Enable Firestore

In Firebase Console:

1. Go to Firestore Database.
2. Create database.
3. Start in production mode.
4. Choose your preferred region.

## 4. Enable Email/Password Auth

In Firebase Console:

1. Go to Authentication.
2. Open Sign-in method.
3. Enable Email/Password.
4. Create your first admin user from the Users tab.

## 5. Add Firestore rules

Open Firestore → Rules and paste the contents of `firestore.rules`.

These MVP rules allow public reads, signed-in admin writes, and public suggestion creation. Later, we should restrict admin writes so each admin can update only assigned masjids.

## 6. Run the site

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 7. Seed or add first masjid data

1. Open `/admin`.
2. Login with the admin user you created in Firebase Auth.
3. If old demo listings exist, click “Remove old demo masjids”.
4. Click “Seed 5 Chennai masjids” or use “Add / edit masjid listing” to add your own listing.
5. Go back home. The status should say “Live Firestore data is connected.”

## 8. Update timings and review suggestions

From `/admin`, select a masjid, edit the jamaat times, and save. The public homepage and masjid page will read the updated data from Firestore.

The same admin page also includes a suggestion review inbox. When users submit corrections from `/suggest/[masjidId]`, admins can apply or reject them.

## Current Firestore collections

```text
masjids/{masjidId}
  name
  locality
  address
  coordinates: { lat, lng }
  phone
  facilities[]
  khutbahLanguages[]
  verificationStatus
  lastVerifiedAt
  jamaat: { fajr, dhuhr, asr, maghrib, isha }
  jumuah[]

jamaatTimings/{masjidId_YYYY-MM-DD}
  masjidId
  date
  jamaat
  jumuah
  source
  updatedAt
  updatedBy

suggestions/{suggestionId}
  masjidId
  field
  suggestedValue
  notes
  status
  createdAt
```
