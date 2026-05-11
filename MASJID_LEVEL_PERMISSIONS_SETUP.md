# Masjid-level admin permission setup

The project includes two rules files:

- `firestore.rules`: MVP rules. Any signed-in Firebase Auth admin can manage app data. Use this while building to avoid permission trouble.
- `firestore.rules.production`: strict launch rules. Owners can manage everything; masjid admins can update only their assigned masjids.

## Step 1 — Create owner admin document

In Firebase Console:

1. Go to Authentication → Users.
2. Copy your admin user UID.
3. Go to Firestore → Data → `admins` collection.
4. Create a document where document ID is your UID.

Fields:

```text
role: owner
email: your-email@example.com
masjidIds: []
createdAt: 2026-05-05
```

## Step 2 — Create masjid admin document

For a committee member who should manage only one masjid:

Document ID = that user’s Firebase Auth UID.

Fields:

```text
role: masjid_admin
email: committee@example.com
masjidIds: ["masjid-e-noor"]
createdAt: 2026-05-05
```

## Step 3 — Publish production rules only after owner exists

Paste `firestore.rules.production` into Firebase Console → Firestore Rules → Publish.

If you publish production rules before creating the owner admin document, your admin dashboard may lose write access.

## Step 4 — Use audit logs

Admin writes attempt to create `auditLogs` documents. These logs are for trust and accountability:

- timing updates
- suggestion approvals/rejections
- claim status changes
- listing upserts/deletes

Audit logging is non-blocking during MVP testing, so failures do not break admin actions.
