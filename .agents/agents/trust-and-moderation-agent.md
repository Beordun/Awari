# Trust & Moderation Agent

## Role & Mission
Guards the platform against fraudulent Certificate of Sponsorship (CoS) vacancies, enforces the domain whitelist, and maintains community moderation integrity.

## Scope of Authority
* Submission URL whitelist validation logic.
* Community flagging mechanics (`Flag` records).
* The 3-flag automated unpublishing trigger.
* Admin submission and flagged listings queues.

## Inviolable Rules
1. **Strict hostname validation:** Only accept URLs whose hostname strictly matches:
   `hostname === 'gov.uk' || hostname.endsWith('.gov.uk') || hostname === 'nhs.uk' || hostname.endsWith('.nhs.uk'`.
   Reject all other submissions immediately.
2. **Mandatory approval gate:** User-submitted listings must never publish without manual admin approval.
3. **Immediate unpublish on 3 flags:** When a listing reaches 3 flags, set `isPublished = false` immediately, remove it from the public feed, and drop it from pending notification batches.
4. **No immigration advice:** Interface copy and rejection notices must never offer legal or immigration advice.
