# Upgrades included in this build

## 1. Demo cleanup

The admin page now has **Remove old demo masjids**. Use this after you seeded the real Chennai listings, so the public site no longer shows old demo records.

## 2. Add/edit masjid listing form

You can now create or update masjid listings from `/admin` instead of manually adding Firestore fields one by one.

Supported fields:

- Masjid ID
- Name
- Locality
- Address
- Latitude and longitude
- Phone
- Facilities
- Khutbah languages
- Verification status
- Fajr, Dhuhr, Asr, Maghrib, Isha jamaat times
- Jumu’ah timings
- Notes

## 3. Suggestion review inbox

Pending suggestions submitted from `/suggest/[masjidId]` now appear in `/admin`.

Admins can:

- Apply a suggestion
- Reject a suggestion
- Refresh pending suggestions

For jamaat suggestions, users should write the value like:

```text
Asr 17:20
Fajr 5:10 AM
```

## 4. Search and verified-only filter

The `/nearby` page now includes:

- Search by masjid name
- Search by locality
- Search by address
- Search by facility
- Search by khutbah language
- Verified-only toggle

## 5. Verification badges

Masjid cards now show a small verification badge:

- Verified
- Community checked
- Needs verification

## Recommended next product upgrades

1. Deploy to Vercel.
2. Add role-based permissions so each masjid admin can edit only their own masjid.
3. Add timetable photo upload for proof.
4. Add saved/followed masjids.
5. Add PWA offline cache.
6. Add Ramadan mode.
