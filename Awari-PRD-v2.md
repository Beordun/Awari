# Product Requirements Document: Awari (v2)

## Role and Goal

You are acting as the product and technical author for Awari. Your goal is to specify a build-ready MVP with no vague requirements, no unresolved either/or decisions, and no unstated assumptions. Where you must assume something, mark it clearly as **Assumption** so it can be challenged later. Do not add scope beyond what is written here.

**The idea, carried forward from the founder:** Awari (from the Yoruba word for "discovery") is a platform that helps skilled workers in the UK find genuine sponsored roles across the NHS, Civil Service, Ministry of Justice, and local Councils, without relying on fraudulent or unverifiable links.

**Status:** Draft v2.0, revised after structured review
**Owner:** Biodun
**Date:** 27 September 2026

---

## 1. Product Summary

Awari aggregates job listings from NHS, Civil Service, MoJ, and Council sources, tags each listing with a sponsorship-likelihood signal, and delivers new listings to users through a website, Telegram, and a daily email digest. It exists to reduce fraud exposure and search friction for people who need a new sponsoring employer in these sectors.

---

## 2. Problem

Skilled workers who need a new sponsoring employer in the UK public sector face two separate problems:

1. **Fraud risk.** Fake or misleading links claiming to offer Certificate of Sponsorship (CoS) roles circulate online, particularly in informal channels such as unmoderated Telegram groups and forwarded messages.
2. **Discovery friction.** Real vacancies exist across NHS, Civil Service, MoJ, and Council job boards, but these are fragmented, inconsistently updated, and rarely state sponsorship eligibility clearly.

**Scope note:** Awari addresses users who need to find a **new** sponsoring employer. It does not address CoS renewal with an existing employer, which is a different process with a different set of needs.

### Persona: Omolola
Omolola holds a Skilled Worker visa. Her current sponsorship is ending and her existing employer cannot or will not continue it, so she needs to find a new sponsoring employer before her visa lapses. She currently searches multiple job boards and Telegram groups manually and cannot reliably tell which listings are genuine or which employers will sponsor.

---

## 3. Goals

- Give users one place to see aggregated, tagged sponsored-role vacancies from NHS, Civil Service, MoJ, and Councils.
- Reduce exposure to fraudulent CoS-related listings by only surfacing vacancies from verifiable sources.
- Notify users promptly when a new relevant listing appears.

Each goal above has a corresponding metric in Section 12. A goal with no metric is not included here.

### Non-Goals
- Awari does not process visa applications or CoS paperwork.
- Awari does not guarantee any listed role will sponsor a candidate. Sponsorship likelihood is a signal, not a confirmation.
- Awari does not offer legal or immigration advice.
- Awari does not cover CoS renewal with an existing employer.
- Awari does not integrate with LinkedIn or Jobrapido, for the legal reasons set out in Section 5.

---

## 4. Users and Personas

| Role | Description |
|---|---|
| Registered user (job seeker) | Signs up with email, browses and filters listings, submits job links for review, joins relevant Telegram channels |
| Admin | Reviews user-submitted listings, monitors pipeline health and Apify usage |

**Assumption:** At MVP stage, there is exactly one admin, the founder. This does not scale past roughly 20 submissions a day. Scaling moderation is out of scope for this version and must be revisited before wider rollout.

There is no employer-facing role in this version.

---

## 5. Scope

### In scope for MVP
- Automated ingestion from NHS Jobs, Civil Service Jobs, and Find a Job via Apify actors.
- User-submitted listings, restricted to a domain whitelist, gated by admin approval.
- Sponsorship-likelihood tagging.
- Website with browse, filter, and search.
- Telegram notifications across four channels.
- One daily email digest per user.

### Out of scope for MVP
- WhatsApp notifications.
- Per-user notification filtering (filtering happens only on the website in this version).
- Regional splitting of the Council Telegram channel.
- Automated sponsorship verification beyond keyword scan and Home Office register cross-check.
- Monetisation features (subscriptions, affiliate links, sponsored placements).
- Employer-facing posting tools.
- LinkedIn and Jobrapido as data sources. Neither offers a permissioned way to read listings. LinkedIn actively enforces against scraping through litigation. Jobrapido is itself an aggregator with unclear data provenance.

---

## 6. Functional Requirements

### 6.1 Job Ingestion
- A scheduled Python worker, hosted on Railway, runs once a day during development and moves to a higher frequency such as every 4 hours in production, only after the criteria in Section 12 are met.
- Each run calls Apify actors for NHS Jobs, Civil Service Jobs, and Find a Job.
- Each run deduplicates against existing PostgreSQL records using the listing's source URL or reference number as the unique key.
- **Failure handling:** if an actor call fails, retry once. If it fails again, log the failure and send an email alert to the admin. Do not silently skip a source. If the Apify monthly usage cap is reached, ingestion stops gracefully for that cycle, an admin alert fires, and the website displays a visible notice that listings may be delayed.
- **Cost control:** a hard usage cap is set in the Apify console, with a webhook or email alert at 80 percent of the monthly budget.

### 6.2 Sponsorship-Likelihood Tagging
Tagging runs inside the Python worker, immediately after deduplication and before the record is written to PostgreSQL.

Each listing receives one tag:
- **Likely Sponsored:** hiring organisation matches the Home Office register of licensed sponsors, and the job description contains a sponsorship-positive keyword.
- **Possibly Sponsored:** either the register match or a keyword match is present, but not both.
- **Unclear:** neither is present.
- **Not Sponsored:** the job description contains an explicit negative phrase, for example "no visa sponsorship available."

**Assumption:** starter keyword list is: "visa sponsorship", "Skilled Worker visa", "Certificate of Sponsorship", "sponsorship available", "unable to sponsor", "cannot sponsor", "no visa sponsorship." This list is expected to be refined after the accuracy audit described in Section 12.

User-reported outcomes are collected as an opt-in field after a user applies, and are reviewed manually to refine the keyword list and register data. This is not automated in this version.

### 6.3 User-Submitted Listings
- Only registered users can submit a listing.
- Submission is checked against a domain whitelist: gov.uk domains and nhs.uk domains only. Anything else is rejected automatically at submission time, with a message explaining why.
- Whitelisted submissions enter an admin queue and are not published until manually approved.
- Once live, any registered user can flag a listing as suspicious. On the third flag, the listing is **immediately unpublished** from the website and removed from any pending notification batch, and returns to the admin queue for re-review. It does not remain visible while under re-review.

### 6.4 Website
- Public listing feed, filterable by department, sponsorship tag, and region.
- Search across job title and description.
- Email-based account creation and login.
- Submission form gated by the domain whitelist above.
- A visible status banner if ingestion has been delayed due to a usage cap or repeated failure (see 6.1).

### 6.5 Notifications

**Telegram**
- Four channels: NHS, Civil Service, MoJ, and Council.
- Each newly tagged listing is posted to its channel immediately after the ingestion cycle that discovered it.
- Telegram channel membership is managed by users directly in Telegram, and Awari does not read channel membership lists.
- When a user clicks "Join NHS Telegram" or equivalent from their website dashboard, that click is logged against their user ID in a `telegram_link_clicks` table. This is a soft signal of intent to join, not proof of membership, since Telegram does not expose membership to bots.

**Email**
- One digest per registered user per day, sent at a fixed time.
- **Assumption:** send time is 07:00 UK time. To be confirmed.
- Includes all listings ingested in the previous 24 hours, unfiltered by department.
- No per-user filtering in this version.

### 6.6 Admin Dashboard

An admin dashboard is required. It is not optional, because Sections 6.1, 6.2, 6.3, and 12 already commit to actions a human must take, and none of those actions have an interface without one.

This is a protected set of routes inside the existing Next.js app, gated by an `isAdmin` flag on the user account. It is not a separate application.

**Cut from scope, deliberately:** no analytics dashboards, no bulk actions, no multiple admin roles or permission levels, no user management beyond suspending an account. This is built for one admin. Anything beyond the four screens below is scope creep at this stage and is rejected.

**Screen 1: Submission queue**
- List of pending user-submitted listings, showing the submitted URL, submitting user, and submission date.
- Approve or reject action per row. Rejection requires no reason field in this version; a rejected submission simply does not publish.

**Screen 2: Flagged listings**
- List of listings that crossed the three-flag threshold and were auto-unpublished, per Section 6.3.
- Shows the listing details and flag count.
- Restore or permanently reject action per row.

**Screen 3: Ingestion health**
- Status of the most recent ingestion run per source (NHS Jobs, Civil Service Jobs, Find a Job): success, retried, or failed.
- Count of new listings ingested per source in the last run.
- Current Apify usage against the monthly cap set in Section 8.

**Screen 4: Tagging audit**
- A list of recently tagged listings with their assigned sponsorship tag.
- A single correct or incorrect action per row, used to run the accuracy audit required in Section 12.
- This screen exists only to support that one-off audit. It is not a permanent moderation tool.

### 6.7 Data Model
See Section 8 for the full Prisma schema. At a high level:
- `Listing`: source details, sponsorship tag, ingestion timestamp.
- `User`: email, registration date, account status.
- `Submission`: submitted URL, submitting user, review status, reviewer, review timestamp.
- `Notification`: listing, channel, sent timestamp. Email rows are per user. Telegram rows are per channel-post-event, since individual Telegram recipients are not tracked.
- `TelegramLinkClick`: user, channel, click timestamp.
- `Flag`: listing, flagging user, timestamp.

---

## 7. AI and AI-Related Tools and Solutions

**Decision, not an open question:** general-purpose AI model APIs (Claude, GPT, Gemini) are not used to discover, search for, or scrape job listings. Reasons:
1. Any browsing or search tool these models use still has to fetch pages through the same access controls a dedicated scraper would face, so it does not solve the ALTCHA or permission problem.
2. Cost per result is materially higher than a dedicated scraping actor at this volume.
3. Language models can hallucinate specific facts such as employer names, salaries, or closing dates when not reading from a grounded, fetched source. For a product whose core value is trust, a single fabricated listing is a serious failure.

**Where an AI model may be used, strictly downstream of a verified fetch:**
- As a secondary classifier over the raw text of a listing that has already been fetched by an Apify actor, to catch sponsorship-positive phrasing the fixed keyword list misses. This is optional, not required for MVP, and must always operate on text already retrieved from a real source, never on a model's own recall.

No other AI tooling is in scope for this version.

---

## 8. Technical Architecture

| Layer | Technology | Notes |
|---|---|---|
| Frontend and user-facing API | Next.js (App Router), TypeScript | Hosted on Vercel |
| ORM | Prisma | Schema below |
| Data ingestion worker | Python | Scheduled job |
| Worker hosting | **Railway** | Locked decision, not an either/or |
| Database | PostgreSQL | Shared source of truth |
| Job data source | Apify actors | Free tier during development, hard usage cap set, paid tier reviewed before scaling |
| Instant notifications | Telegram Bot API | Four channels |
| Digest notifications | **Resend** | Locked decision |

### Prisma Data Model

```prisma
model Listing {
  id               String   @id @default(cuid())
  sourceUrl        String   @unique
  referenceNumber  String?
  title            String
  department       Department
  employer         String
  location         String
  salary           String?
  contractType     String?
  closingDate      DateTime?
  sponsorshipTag   SponsorshipTag
  ingestedAt       DateTime @default(now())
  flags            Flag[]
  notifications    Notification[]
  tagAudits        TagAudit[]
}

enum Department {
  NHS
  CIVIL_SERVICE
  MOJ
  COUNCIL
}

enum SponsorshipTag {
  LIKELY_SPONSORED
  POSSIBLY_SPONSORED
  UNCLEAR
  NOT_SPONSORED
}

model User {
  id                 String   @id @default(cuid())
  email              String   @unique
  createdAt          DateTime @default(now())
  status             UserStatus @default(ACTIVE)
  isAdmin            Boolean  @default(false)
  submissions        Submission[]
  flags              Flag[]
  notifications      Notification[]
  telegramLinkClicks TelegramLinkClick[]
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}

model Submission {
  id           String   @id @default(cuid())
  submittedUrl String
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  status       SubmissionStatus @default(PENDING)
  reviewedBy   String?
  reviewedAt   DateTime?
  createdAt    DateTime @default(now())
}

enum SubmissionStatus {
  PENDING
  APPROVED
  REJECTED
}

model Notification {
  id         String   @id @default(cuid())
  listingId  String
  listing    Listing  @relation(fields: [listingId], references: [id])
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  channel    NotificationChannel
  sentAt     DateTime @default(now())
}

enum NotificationChannel {
  EMAIL
  TELEGRAM_NHS
  TELEGRAM_CIVIL_SERVICE
  TELEGRAM_MOJ
  TELEGRAM_COUNCIL
}

model TelegramLinkClick {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  channel   NotificationChannel
  clickedAt DateTime @default(now())
}

model Flag {
  id         String   @id @default(cuid())
  listingId  String
  listing    Listing  @relation(fields: [listingId], references: [id])
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  createdAt  DateTime @default(now())
}

model TagAudit {
  id          String   @id @default(cuid())
  listingId   String
  listing     Listing  @relation(fields: [listingId], references: [id])
  isCorrect   Boolean
  auditedBy   String
  auditedAt   DateTime @default(now())
}
```

The `TagAudit` model exists only to support the one-off accuracy audit in Section 12. It is not a recurring feature and should not be built out further than this.

### Failure Handling
- Apify actor failure: retry once, then alert admin by email.
- Apify budget exhausted: stop ingestion for the cycle, alert admin, show a delay notice on the website.
- No listings ingested in a cycle: log as a warning, not treated as an error, since some cycles may genuinely have no new listings.

### Why Railway, Not Vercel, for the Worker
Vercel serverless functions have execution time ceilings, and lower-tier cron scheduling is daily-only. The ingestion worker needs predictable scheduling independent of these constraints.

---

## 9. Vector Database Architecture and Design

**Flagged assumption:** the current MVP scope, as described in every prior section, does not require a vector database. Search in Section 6.4 is keyword-based (title and description text match), and sponsorship tagging in Section 6.2 is rule-based, not embedding-based. Adding a vector database now would be scope beyond what the product needs to validate its core hypothesis.

This section is included because it was requested, but the honest recommendation is to **defer** this until there is a proven need, for example:
- Semantic search across job descriptions once keyword search proves too rigid for users (e.g. a user searching "nurse" should also see "staff nurse" or "registered general nurse" listings).
- Similarity matching between a user's stated skills and listing descriptions, if a future personalisation feature is built.

**If and when this becomes justified**, the design would be:
- Store embeddings for each listing's title and description, generated once at ingestion time using a fixed embedding model.
- Use a PostgreSQL extension such as pgvector, rather than a separate vector database service, to avoid adding another piece of infrastructure to an already multi-service stack.
- Index on the description embedding column with an approximate nearest neighbour index once listing volume is high enough to need it, for example above 50,000 rows.

### Vector Database Model (deferred, for future reference only)

```prisma
model ListingEmbedding {
  id         String   @id @default(cuid())
  listingId  String   @unique
  listing    Listing  @relation(fields: [listingId], references: [id])
  embedding  Unsupported("vector(1536)")
  model      String
  createdAt  DateTime @default(now())
}
```

This is not part of the MVP build. It is documented here to avoid re-deriving the design later, and should not be implemented until the deferred trigger conditions above are met.

---

## 10. Business Model

**Assumption, to be confirmed by the founder:** the MVP is self-funded. There is no monetisation feature in this version, but real recurring costs exist: Apify usage, Railway hosting, Resend sends, and Vercel hosting. A monthly spend ceiling must be agreed before launch so the project does not accumulate open-ended cost with no revenue offset. Monetisation options to consider once the product is validated, but not built now: a paid tier for higher notification frequency, or partnerships with immigration advisors. Neither is scoped or designed in this version.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Apify actors bypass an ALTCHA anti-bot check on Civil Service Jobs; this is a materially different legal position from reading an open feed | Legal review, even informal, before production launch. If unfavourable, fall back to user-submitted listings as the primary source rather than automated scraping |
| Apify actor could be taken down, blocked, or changed by its maintainer without notice | Treat as a known fragility. User submissions must remain functional independently, not just as a supplement |
| Sponsorship tagging may be inaccurate, since most adverts do not clearly state sponsorship status | Communicate tags as likelihood, not certainty. Run the accuracy audit in Section 12 before scaling |
| Telegram channel volume, particularly Council, could grow unmanageable | Monitor volume. Split the Council channel regionally if it starts to dominate |
| Apify free tier usage could be exceeded even at low cadence | Hard usage cap in Apify console, plus webhook alert at 80 percent, not manual monitoring alone |
| User-submitted listings could still carry fraud risk despite the whitelist | Domain whitelist, mandatory admin approval, and immediate unpublish on flag threshold |
| Single admin cannot scale moderation past a low volume | Stated cap of roughly 20 submissions a day for MVP; revisit before wider rollout |

---

## 12. Success Metrics

Before increasing ingestion frequency, adding data sources, or building new features, the following must be met:

- End-to-end pipeline working: ingest, dedupe, tag, store, dispatch via Telegram and email, with failure handling as specified in Section 8 confirmed working through at least one simulated actor failure.
- At least one full cycle of a user-submitted listing tested through the whitelist, approval queue, and publish flow.
- A minimum of 300 combined sign-ups and Telegram channel joins, as the threshold to justify moving off the Apify free tier.
- A manual accuracy audit of 50 tagged listings against known outcomes, with at least 80 percent of "Likely Sponsored" tags confirmed correct, before scaling ingestion frequency.

---

## 13. Open Questions

| Question | Owner | Resolve by |
|---|---|---|
| Confirm the exact email digest send time | Biodun | Before launch |
| Set the exact monthly spend ceiling for the self-funded MVP | Biodun | Before launch |
| Confirm the subscriber or listing volume at which the Council Telegram channel should be split regionally | Biodun | After first 300 sign-ups milestone |
| Decide whether to pursue a formal data-sharing conversation with NHS Jobs, Civil Service Jobs, or Find a Job, as an alternative to Apify-based scraping | Biodun | Before production launch, tied to the legal review in Section 11 |
| Confirm the starter keyword list for sponsorship tagging after the first accuracy audit | Biodun | After first accuracy audit |
