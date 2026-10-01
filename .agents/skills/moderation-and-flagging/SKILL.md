---
name: moderation-and-flagging
description: >-
  Procedures for validating user-submitted job links against the strict gov.uk/nhs.uk whitelist,
  managing the admin review queue, and executing the 3-flag auto-unpublishing policy.
---

# Moderation and Flagging Runbook

This skill outlines the fraud prevention mechanisms, whitelist validation, and community moderation workflows in Awari.

## 1. Domain Whitelist Validation

When a registered user submits a URL on `/submit`, enforce strict hostname checking:

```typescript
export function isValidWhitelistedUrl(inputUrl: string): boolean {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'gov.uk' ||
      hostname.endsWith('.gov.uk') ||
      hostname === 'nhs.uk' ||
      hostname.endsWith('.nhs.uk')
    );
  } catch {
    return false;
  }
}
```

* If valid: Create `Submission(status = PENDING)`.
* If invalid: Reject immediately with an error explaining that only official government (`gov.uk`) and NHS (`nhs.uk`) URLs are accepted.

## 2. Admin Review Workflow

1. Navigate to `/admin/submissions`.
2. Admin reviews the submitted URL.
3. Form modal requires the admin to enter/confirm:
   * Title
   * Department (`NHS`, `CIVIL_SERVICE`, `MOJ`, `COUNCIL`)
   * Employer
   * Location
   * Salary & Contract Type (optional)
   * Closing Date (optional)
   * Job Description
4. On **Approve**:
   * Creates `Listing` with `isPublished = true`.
   * Evaluates sponsorship tag using the deterministic tagging rules.
   * Updates `Submission(status = APPROVED, reviewedBy = adminId, reviewedAt = now())`.
   * Dispatches instant Telegram post to the respective channel.
5. On **Reject**:
   * Updates `Submission(status = REJECTED)`. No listing is created.

## 3. The 3-Flag Auto-Unpublishing Policy

1. Any authenticated user can submit a flag via the UI (`Flag` record linking `userId` and `listingId`).
2. An existing `@@unique([listingId, userId])` prevents a user from flagging a listing multiple times.
3. Upon inserting a `Flag`, count the total flags for that listing.
4. **If flags >= 3**:
   * Set `Listing.isPublished = false` immediately.
   * Omit the listing from all active public feeds (`WHERE isPublished = true`).
   * Exclude from the pending daily email digest batch.
   * Route the listing to `/admin/flagged`.
5. **Admin Flag Resolution**:
   * **Restore:** Admin sets `isPublished = true` (listing returns to public view).
   * **Delete / Permanently Reject:** Admin confirms fraudulent nature and deletes or permanently marks it rejected.
