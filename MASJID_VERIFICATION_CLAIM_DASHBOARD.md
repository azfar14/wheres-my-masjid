# Masjid Verification + Claim Dashboard

This build adds a dedicated trust operations page:

```text
/admin/verification
```

## What it does

- Reviews every masjid that is not fully verified.
- Locks direct Google turn-by-turn navigation until the listing is route-tested.
- Lets an owner/reviewer approve claim requests and assign a Firebase Auth UID to a masjid.
- Creates/updates `admins/{uid}` documents with `role` and `masjidIds`.
- Stores verification checklist fields on the masjid document.
- Writes audit logs for claim assignment, admin profile updates, and verification updates.

## Navigation trust rule

Direct route buttons are only unlocked when:

```text
verificationStatus = admin_verified OR community_checked
navigationVerified = true
```

`navigationVerified` becomes true when the checklist is complete:

```text
nameChecked
addressChecked
pinChecked
routeTested
timingsChecked
```

External Foursquare/Mappls/OSM listings still open Google Maps search first until an admin verifies the exact pin.

## Claim workflow

1. Public user submits `/claim/[masjidId]`.
2. Owner opens `/admin/verification`.
3. Owner confirms identity outside the app.
4. Owner creates the claimant in Firebase Authentication if needed.
5. Owner copies that user's Firebase Auth UID.
6. Owner approves the claim and assigns the UID.
7. The app writes/updates:

```text
admins/{uid}
claimRequests/{claimId}
masjids/{masjidId}.assignedAdminIds
```

## Production rules

Use `firestore.rules` for MVP testing. Use `firestore.rules.production` when you have created an owner admin document and are ready for stricter permissions.

Owner bootstrap:

```text
Firebase Authentication → Users → copy your UID
Firestore → admins → Add document
Document ID = your UID
role = owner
email = your email
masjidIds = []
```

## Public launch requirement

Before launch, verify at least 10–20 masjids in your target area with:

- correct Google Maps pin
- route-tested navigation
- verified jamaat timings
- Jumu’ah timings
- claim/admin ownership where possible
