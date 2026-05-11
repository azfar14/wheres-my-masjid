# Firestore permissions fix

If `/admin` shows `Missing or insufficient permissions`, Firebase is still using older rules.

Fix:

1. Open Firebase Console.
2. Go to Firestore Database → Rules.
3. Paste the contents of `firestore.rules` from this project.
4. Click Publish.
5. Refresh `/admin` and log in again.

These are MVP rules. They allow public users to read masjids and submit suggestions/claim requests, and allow any Firebase Authentication user you manually create to manage admin data. Before public launch, replace this with masjid-level admin permissions.
