# Security Specification for Aetheria NFT Museum & Museum Pass (MP)

## 1. Data Invariants
1. **Pass Identity Invariant**: A Museum Pass (`museum_passes/{passId}`) must contain a valid Ethereum hex address (`0x[a-fA-F0-9]{40}`) as `ownerAddress` and valid alphanumeric `tokenId`.
2. **Tier Integrity**: Pass tier must be strictly one of `['STANDARD', 'PATRON', 'CURATOR']`.
3. **Transaction Immutability**: Blockchain transactions in `transactions/{txId}` are write-once records and cannot be altered or deleted.
4. **Exhibit State Bounds**: Exhibits allow community likes and bid increments via controlled action-based updates (`affectedKeys().hasOnly(['likesCount'])` or `affectedKeys().hasOnly(['currentBid', 'bidsCount', 'updatedAt'])`).
5. **Guestbook Sanitization**: Guestbook entries must not exceed 280 characters for `message` and 64 characters for `nickname` to prevent denial-of-wallet / payload inflation.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Payload 1 (Shadow Update Attack on Pass)**:
   Attempting to update `museum_passes/mp-1` by injecting ghost field `isAdmin: true` or changing `ownerAddress`.
   -> Expected: `PERMISSION_DENIED`
2. **Payload 2 (Invalid Tier Injection)**:
   Attempting to create `museum_passes/mp-2` with tier `GOD_MODE` or `SUPER_USER`.
   -> Expected: `PERMISSION_DENIED`
3. **Payload 3 (Oversized ID / Denial of Wallet Attack)**:
   Attempting to write to `museum_passes/{hugeId}` where ID is > 128 characters or contains malicious path traversals `../../`.
   -> Expected: `PERMISSION_DENIED`
4. **Payload 4 (Oversized Guestbook Payload)**:
   Attempting to write a 1MB spam string into `guestbook/{id}` message field.
   -> Expected: `PERMISSION_DENIED` (strictly capped at `<= 280` characters).
5. **Payload 5 (Transaction Tampering)**:
   Attempting an update on an existing `transactions/{txId}` document to change `status` from `FAILED` to `CONFIRMED`.
   -> Expected: `PERMISSION_DENIED` (transactions are immutable).
6. **Payload 6 (Arbitrary Exhibit Deletion)**:
   Attempting a `delete` operation on an `exhibits/{exhibitId}` artwork by an unauthenticated / public caller.
   -> Expected: `PERMISSION_DENIED`.
7. **Payload 7 (Exhibit Schema Poisoning)**:
   Attempting an update to `exhibits/ex-1` adding arbitrary fields `arbitraryScript: '<script>'`.
   -> Expected: `PERMISSION_DENIED`.
8. **Payload 8 (Negative Like / Bid Counter Attack)**:
   Attempting to set `likesCount` to `-999` or non-numeric string `"lots"`.
   -> Expected: `PERMISSION_DENIED`.
9. **Payload 9 (Blanket Query Scraping)**:
   Attempting to query non-public internal collections without authentication.
   -> Expected: `PERMISSION_DENIED`.
10. **Payload 10 (Malformed Ethereum Address)**:
    Writing a pass with `ownerAddress: "not-an-address"`.
    -> Expected: `PERMISSION_DENIED`.
11. **Payload 11 (Timestamp Fraud)**:
    Passing future or forged timestamps or non-string invalid dates.
    -> Expected: `PERMISSION_DENIED`.
12. **Payload 12 (Root Traversal / System Collection Write)**:
    Attempting to write to arbitrary root documents `/{document=**}`.
    -> Expected: `PERMISSION_DENIED`.

## 3. Test Runner
Verified via rule structure testing ensuring all write-paths enforce strict key schemas and size boundary checks.
