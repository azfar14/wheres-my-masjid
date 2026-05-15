# Acquisition Machine Pass

This pass keeps the existing public app flow intact while adding a safe masjid-operations layer.

## Added

- Global footer on every page with dynamic year:
  - © YEAR Wannaapps Technologies. All rights reserved.
  - Initiative + developer credits with official links.
- Approved masjid dashboard at `/my-masjids`.
- `/masjid-admin` redirects to `/my-masjids` as a friendly alias.
- Approved masjid admins can update:
  - Jamaat timings
  - Jumu’ah timings
  - Phone/contact
  - Facilities
  - Khutbah languages
  - Public profile note
  - Public announcements
- Public masjid profiles now show active announcements.
- Firestore rules now include `masjidAnnouncements`.

## Safety

- Normal users still use Nearby, Qibla, Saved, Claim, and Missing.
- Claim requests still require manual admin approval.
- Masjid admins are limited by the `admins/{uid}.masjidIds` list.
- Internal diagnostics are still not exposed through the public Network page.
