---
name: notification-dispatcher
description: >-
  Procedures for managing instant notifications across the 4 Telegram channels and executing
  the daily morning email digest via Resend with guaranteed daily idempotency.
---

# Notification Dispatcher Runbook

This skill coordinates real-time Telegram channel updates and daily email digest delivery.

## 1. Telegram Channel Management

Four public channels exist:
1. `TELEGRAM_NHS`
2. `TELEGRAM_CIVIL_SERVICE`
3. `TELEGRAM_MOJ`
4. `TELEGRAM_COUNCIL`

### Dispatch Timing
* **Automated Batch Listings:** Dispatched by the Python worker immediately following an ingestion run.
* **Approved User Listings:** Dispatched by Next.js Server Action immediately upon admin approval.

### Message Template
```text
💼 {title}
🏢 {employer} | 📍 {location}
🏛️ Department: {department}
🏷️ Sponsorship Signal: {sponsorshipTag}

🔗 View genuine vacancy: {sourceUrl}

⚠️ Awari provides sponsorship likelihood signals based on public data. This is not a guarantee of visa sponsorship.
```

### Member Tracking Rule
Awari does **NOT** read or store Telegram channel member lists. When a user clicks "Join Telegram" from their web dashboard, write a `TelegramLinkClick` record to track user engagement without violating privacy.

---

## 2. Daily Email Digest (Resend)

* **Send Schedule:** Daily at 07:00 UK time.
* **Scope:** All published listings (`isPublished = true`) ingested in the preceding 24 hours.

### Delivery Idempotency Rule
To strictly enforce Rule 16 ("Never send more than one email digest per user per day"):
```sql
SELECT 1 FROM "Notification"
WHERE "userId" = :user_id
  AND "channel" = 'EMAIL'
  AND "sentAt" >= CURRENT_DATE;
```
If a record exists for that user on today's calendar date, skip sending.

### Email Batching Workflow
1. Fetch all active registered users: `User.findMany({ where: { status: 'ACTIVE' } })`.
2. Fetch new listings from last 24h: `Listing.findMany({ where: { isPublished: true, ingestedAt: { gte: yesterday } } })`.
3. If no new listings, log warning and do not send empty digests.
4. Batch dispatch using Resend Batch API (`resend.batch.send`).
5. For each successful dispatch, insert `Notification(listingId, userId, channel = EMAIL, sentAt = now())`.
