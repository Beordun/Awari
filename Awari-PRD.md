# Product Requirements Document: Awari

**Tagline:** Awari (from the Yoruba "awari", meaning "discovery" or "to find") is a platform that helps skilled workers in the UK find genuine sponsored roles across the NHS, Civil Service, Ministry of Justice, and local Councils.

**Status:** Draft v1.0
**Owner:** Biodun
**Date:** 27 September 2026

---

## 1. Problem Statement

Skilled workers on visa sponsorship in the UK face two compounding problems when their Certificate of Sponsorship (CoS) is due to expire or when they need a new sponsored role:

1. **Fraud risk.** Many links and adverts circulating online claim to offer CoS-backed roles with the NHS, MoJ, or Civil Service. A meaningful number of these are fake, outdated, or designed to extract money or personal data from desperate applicants.
2. **Discovery friction.** Genuine sponsored vacancies exist across NHS, Civil Service, MoJ, and Council job boards, but these boards are fragmented, inconsistently updated, and rarely state sponsorship eligibility clearly in the advert itself.

### Persona: Omolola
Omolola is a skilled worker in the UK. Her sponsorship visa is expiring soon and she needs to secure a new sponsored role before it lapses. She spends hours a week searching multiple job boards and Telegram groups, unsure which listings are real, and cannot tell from the job title alone whether a role will sponsor her.

### Why Now
This is a recurring, time-pressured need. Anyone on a Skilled Worker visa faces this exact situation, repeatedly, for as long as they remain in the UK on sponsorship.

---

## 2. Goals

- Give users a single, trustworthy place to see genuine sponsored-role vacancies from NHS, Civil Service, MoJ, and Councils.
- Reduce the time and anxiety involved in finding a legitimate sponsored role.
- Reduce exposure to fraudulent CoS-related listings by only surfacing vacancies pulled from verifiable sources.
- Alert users the moment a relevant new listing appears, through their channel of choice.

### Non-Goals (explicitly out of scope for v1)
- Awari does not process visa applications or CoS paperwork.
- Awari does not guarantee that any listed role will sponsor a candidate. Sponsorship likelihood is a signal, not a confirmation.
- Awari does not offer legal or immigration advice.
- Awari is not a general job board. It only covers NHS, Civil Service, MoJ, and Council roles.
- Awari does not integrate with LinkedIn or Jobrapido. Neither offers a permissioned way to pull listings, and both carry legal exposure if scraped directly.

---

## 3. Data Sourcing (Foundational Constraint)

This section reflects a verified finding, not an assumption: **none of NHS Jobs, Civil Service Jobs, or Find a Job (gov.uk) offer an official public read/search API.**

- Civil Service Jobs had a public API around 2009 to 2012. It was retired, and the associated open dataset was discontinued in 2016. The live site sits behind an ALTCHA anti-bot check.
- Find a Job (gov.uk) exposes a Recruitment API, but it is one-directional and built for employers to post vacancies, not for third parties to read them.
- NHS Jobs has no public API or bulk data export.

### Sourcing Strategy for v1
1. **Paid third-party scraping services (Apify actors)** used to bootstrap and maintain a feed of structured listings from Civil Service Jobs, Find a Job, and NHS Jobs. This is the primary automated source.
2. **User-submitted listings**, restricted to a whitelist of approved domains only (gov.uk and NHS domains). Submissions require a registered account and go into an admin approval queue before publishing. This is a supplementary source, not the primary one.
3. During development, Apify's free tier is used, with ingestion capped at a single run per day to stay within the free usage credit. Production cadence and paid tier are to be revisited once the product is validated with real users.

### Explicitly Excluded Sources
- LinkedIn (no accessible API for this use case, active anti-scraping enforcement)
- Jobrapido (itself an aggregator with unclear data provenance, no clean API)

---

## 4. User Roles

| Role | Description |
|---|---|
| Registered user (job seeker) | Signs up with email, browses listings on the website, can submit a job link for review, can join relevant Telegram channels |
| Admin | Reviews and approves or rejects user-submitted listings, monitors data pipeline health |

There is no employer-facing role in v1. Awari does not accept direct postings from employers.

---

## 5. Functional Requirements

### 5.1 Job Ingestion
- A scheduled Python worker runs on a fixed cadence (once per day in development, moving towards a higher frequency such as every 4 hours in production once validated) to pull structured listings via Apify actors covering NHS Jobs, Civil Service Jobs, and Find a Job.
- Each ingestion run deduplicates listings against existing records in PostgreSQL, using the job's URL or reference number as the unique key.
- New and updated listings are tagged with a sponsorship-likelihood label before being written to the database.

### 5.2 Sponsorship-Likelihood Tagging
Every listing receives one of the following tags:

- **Likely Sponsored**
- **Possibly Sponsored**
- **Unclear**
- **Not Sponsored**

Tagging logic for v1:
1. Keyword scan of the job description for sponsorship-related phrases (for example, "visa sponsorship", "Skilled Worker visa", "Certificate of Sponsorship", "no visa sponsorship available").
2. Cross-reference of the hiring organisation against the Home Office's public register of licensed sponsors.
3. User-reported outcomes (opt-in). A user who applies can confirm whether sponsorship was genuinely offered, and this feedback is used to refine future tagging. This is a manual, opt-in step, not automated in v1.

### 5.3 User-Submitted Listings
- Only registered users can submit a listing.
- A submitted URL is checked against a domain whitelist (gov.uk and NHS domains only). Anything outside the whitelist is rejected automatically at submission time.
- Approved-domain submissions enter an admin review queue and are not published until manually approved.
- Once live, other registered users can flag a listing as suspicious. Three flags return it to the review queue automatically.

### 5.4 Website
- Public-facing listing feed, filterable by department (NHS, Civil Service, MoJ, Council), sponsorship-likelihood tag, and region.
- Search function across job title and description.
- User account creation and login (email-based).
- A submission form for users to propose a listing, gated by the domain whitelist above.

### 5.5 Notifications

**Telegram**
- Four separate channels: NHS, Civil Service, MoJ, and Council.
- Each new tagged listing is posted to its relevant channel immediately after the ingestion cycle that discovered it.
- Users self-manage subscription by joining or leaving channels directly in Telegram. Awari does not track individual channel membership in its own database.

**Email**
- One consolidated digest per user per day, sent at a fixed time.
- The digest includes all listings ingested in the previous 24 hours, unfiltered by department.
- No per-user preference filtering in v1. All filtering happens on the website, not in the notification content.

### 5.6 Data Model (high level)
- `listings`: job title, department, employer, location, salary, contract type, closing date, source URL, sponsorship tag, ingestion timestamp
- `users`: email, registration date, account status
- `submissions`: submitted URL, submitting user, status (pending, approved, rejected), reviewed by, reviewed at
- `notifications`: listing ID, user ID, channel, sent at (used to prevent duplicate sends within the same channel)

---

## 6. Technical Architecture

| Layer | Technology | Notes |
|---|---|---|
| Frontend and user-facing API | Next.js (App Router), TypeScript | Hosted on Vercel |
| Data ingestion worker | Python | Scheduled job, not request-driven |
| Worker hosting | Railway or Render | Chosen over Vercel because ingestion needs reliable scheduling without Vercel's serverless execution time limits |
| Database | PostgreSQL | Shared source of truth for both the Next.js app and the Python worker |
| Job data source | Apify actors (paid, third-party) | Free tier during development, review pricing before production scaling |
| Instant notifications | Telegram Bot API, four channels | Free, no per-message cost |
| Digest notifications | Email (provider to be confirmed, e.g. Resend or SendGrid) | One send per user per day |

### Why Not Vercel for the Worker
Vercel's serverless functions have execution time ceilings, and its cron scheduling on lower tiers is limited to daily-only triggers. The ingestion worker needs predictable, reliable scheduling independent of these constraints, so it is hosted separately.

---

## 7. Out of Scope for MVP

These are acknowledged as valuable but deliberately excluded to keep the MVP lean:

- WhatsApp notifications (requires a paid, gated Business API; Telegram and email cover the same need at far lower cost and complexity for v1)
- Per-user notification filtering (everyone receives everything for now; filtering happens only on the website)
- Regional splitting of the Council Telegram channel (flagged as a likely future need once Council coverage broadens, but not required at launch)
- Automated verification of sponsorship status beyond keyword scanning and the Home Office register cross-check
- Any monetisation feature (subscription tiers, affiliate partnerships, sponsored placements)
- Employer-facing posting tools

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| No official APIs exist for target job boards; reliance on third-party scrapers | Use maintained Apify actors rather than building and maintaining scraping infrastructure directly; monitor for actor failures |
| Third-party scraper actor could be taken down or blocked | Treat this as a known fragility; keep user submissions as a secondary source that does not depend on scraping |
| Sponsorship tagging may be inaccurate, since most job adverts do not clearly state sponsorship status | Communicate tags as likelihood, not certainty, throughout the product; build in user-reported outcome feedback over time |
| Telegram channel volume, particularly Council, could grow unmanageable | Monitor volume; be prepared to split the Council channel regionally if it starts to dominate |
| Apify free tier usage costs could exceed the free credit even at low cadence | Monitor usage dashboard closely during development; move to a paid tier before scaling ingestion frequency |
| User-submitted listings could still introduce fraudulent content despite the whitelist | Domain whitelist plus mandatory admin approval before publishing, plus community flagging after publication |

---

## 9. Success Criteria for MVP Validation

Before investing further in additional data sources, higher ingestion frequency, or new features:

- A working end-to-end pipeline: ingest, dedupe, tag, store, and dispatch via both Telegram and email.
- A functioning website where users can browse, filter, and search listings.
- At least one full cycle of user-submitted listings tested through the whitelist and approval queue.
- Demonstrated user interest, measured by sign-ups and Telegram channel joins, sufficient to justify moving off the free Apify tier and increasing ingestion frequency.

---

## 10. Open Questions

- Which email provider will be used for the daily digest (Resend, SendGrid, or another)?
- What is the specific fixed time of day for the email digest send?
- At what subscriber or listing volume should the Council Telegram channel be reconsidered for regional splitting?
- What is the process and timeline for contacting NHS Jobs, Civil Service Jobs, or Find a Job directly to explore a formal data-sharing arrangement, as an alternative to ongoing reliance on third-party scrapers?
