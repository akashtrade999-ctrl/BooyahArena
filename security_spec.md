# Security Specification: Free Fire Tournament Platform

## 1. Data Invariants
1. **Identity Integrity**: A player can only create or update their own `users/{userId}` profile and `tournaments/{tournamentId}/registrations/{userId}` document where `userId == request.auth.uid`.
2. **PII Isolation**: Private contact fields (`email`, `phoneNumber`) live solely in `users/{userId}`, which is strictly restricted to the owner (`request.auth.uid == userId`) or verified admins (`isAdmin()`). Public standings live in `leaderboard/{userId}` with zero PII.
3. **Room Credential Gating**: `tournaments/{tournamentId}/roomCredentials/{credId}` is unreadable by unauthenticated or non-joined users. Joined players can only read it once `request.time >= get(tournament).data.revealAt`. Only admins can write credentials.
4. **Atomic Slot Registration**: Creating a registration in `tournaments/{tournamentId}/registrations/{userId}` requires atomically incrementing `filledSlots` by exactly `1` on the parent `tournaments/{tournamentId}` document, and only while `status == 'upcoming'` and `filledSlots < maxSlots`.
5. **Admin-Only Settlement & Rewards**: Regular users cannot modify `kills`, `placement`, `pointsAwarded`, `prizeAwarded`, `resultStatus`, `totalPoints`, `totalWinnings`, `totalKills`, or `matchesPlayed`. Only verified admins can create/delete tournaments or settle match results.
6. **Terminal State Locking**: Once a tournament reaches `status == 'completed'`, non-admins cannot update it or create new registrations; only admins can make corrections.
7. **Temporal Integrity**: `createdAt`, `joinedAt`, and `updatedAt` timestamps must match `request.time`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Identity Spoofing on Registration**: User A attempts to create `tournaments/t1/registrations/userB` with `userId: "userB"`.
2. **Self-Awarded Kills/Prizes on Join**: User A attempts to create registration with `kills: 12`, `prizeAwarded: 5000`, `resultStatus: "settled"`.
3. **Ghost Field Shadow Write**: User A attempts to write `isVerified: true` or `role: "admin"` inside `users/userA`.
4. **Privilege Escalation on Points**: User A attempts to update `totalWinnings: 99999` on `users/userA` or `leaderboard/userA`.
5. **Unauthenticated Room Credential Read**: Unauthenticated client attempts `get` on `tournaments/t1/roomCredentials/access`.
6. **Non-Joined Player Room Credential Read**: Signed-in User C (not registered in `t1`) attempts `get` on `tournaments/t1/roomCredentials/access`.
7. **Premature Room Credential Read**: Registered User A attempts `get` on `tournaments/t1/roomCredentials/access` before `revealAt`.
8. **PII Blanket Read**: Signed-in User A attempts `get` or `list` on `users/userB`.
9. **Email Spoof Admin Escalation**: User with unverified email (`email_verified: false`) matching admin email attempts to create a tournament.
10. **Orphaned Registration / Non-Atomic Slot Bypass**: User A attempts to create registration without incrementing parent `filledSlots` in the same batch.
11. **Joining Completed or Full Match**: User A attempts to register for a tournament where `status == 'completed'` or `filledSlots >= maxSlots`.
12. **Resource Poisoning via Oversized ID or String**: Client attempts write with 500-char `tournamentId` or 10KB `ign`.
