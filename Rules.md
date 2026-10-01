# Awari Engineering & Operating Rules

The source of truth for product decisions is `Awari-PRD-v2.md`. If any instruction or assumption conflicts with the PRD, stop and ask the owner.

---

## 1. Locked Stack

- **Frontend & Web API:** Next.js (App Router), TypeScript, hosted on Vercel
- **Authentication:** NextAuth / Auth.js with Resend (passwordless email magic links)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Worker Runtime:** Python (using `psycopg2-binary` or `SQLAlchemy`), hosted on Railway
- **Data Sourcing:** Apify actors
- **Messaging:** Telegram Bot API (4 channels)
- **Email Delivery:** Resend

> **Rule:** Do not add a new framework, service, database, queue, or paid tool without explicit owner approval.

---

## 2. Non-Negotiable Rules

You must follow every rule in this section. Do not bend them under any circumstance.

### Data Sourcing

1. **No custom scrapers:** Do not write custom scrapers for NHS Jobs, Civil Service Jobs, or Find a Job. Job data enters exclusively via Apify actors or approved user submissions.
2. **Banned sources:** Do not use LinkedIn or Jobrapido in any form.
3. **No AI-generated listings:** Do not use LLMs (Claude, GPT, Gemini, etc.) to discover, search for, or generate job listings. A model may only process text already retrieved from a grounded fetch.
4. **No placeholder data:** Never invent, fill in, or guess listing data (employers, salaries, closing dates). Test data must be strictly isolated and labeled.
5. **No anti-bot bypasses:** Do not write code to bypass anti-bot mechanisms (e.g., ALTCHA). Access stays inside Apify actors under legal review.

### Trust & Moderation

6. **Strict domain whitelist:** All user-submitted URLs must strictly match:
   `hostname === 'gov.uk' || hostname.endsWith('.gov.uk') || hostname === 'nhs.uk' || hostname.endsWith('.nhs.uk'`.
   Reject all other domains at submission time.
7. **Mandatory admin review:** User-submitted listings must never publish automatically. The admin enters/verifies listing details before publishing.
8. **3-Flag auto-unpublish:** When a listing receives 3 flags, set `isPublished = false` immediately and remove it from pending notifications. Public queries must always enforce `where: { isPublished: true }`.
9. **Likelihood, not guarantee:** Never state or imply that any role guarantees visa sponsorship. All tags represent likelihood signals only.
10. **No legal advice:** Never present any text, tag, or notification as legal or immigration advice.

### Pipeline & Tagging

11. **Deterministic tagging & negative override:** Tagging runs in the Python worker (and on admin submission approval) after deduplication and before writing to PostgreSQL:
    - **`NOT_SPONSORED` (Strict Precedence):** Job description contains explicit negative phrases (_"no visa sponsorship"_, _"unable to sponsor"_, etc.). This overrides all positive signals.
    - **`LIKELY_SPONSORED`:** Employer matches the Home Office sponsor register AND description contains a sponsorship-positive keyword.
    - **`POSSIBLY_SPONSORED`:** Either register match OR positive keyword match is present, but not both.
    - **`UNCLEAR`:** Neither match is present.
12. **Canonical URL deduplication:** Deduplicate on canonical source URLs (strip tracking query params like `utm_*` or `ref`, strip trailing slashes, and lowercase scheme/domain).
13. **Ingestion logging:** Every run must log an `IngestionRun` record (`SUCCESS`, `RETRIED`, or `FAILED`). If an Apify actor fails, retry once; if it fails again, log `FAILED` and alert the admin via email.
14. **Usage cap enforcement:** If the Apify budget cap is reached, halt ingestion for that cycle, log it, alert the admin, and render the delay banner on the website.
15. **Fixed frequency:** Ingestion runs once per day during development. Do not increase frequency until Section 12 success metrics are met.

### Notifications

16. **Daily email digest:** Send exactly one email digest per user per day at 07:00 UK time. Enforce daily idempotency by checking `Notification` records (`channel = EMAIL`, `sentAt >= CURRENT_DATE`).
17. **Four Telegram channels:** Post exclusively to the four designated channels (`NHS`, `Civil Service`, `MoJ`, `Council`). Dispatched by the Python worker for batch runs and by Next.js for approved user submissions.
18. **No custom notification filters:** Do not build per-user notification filtering (all filtering is on-site only).
19. **No channel member tracking:** Do not attempt to read or store Telegram channel memberships. Log only `TelegramLinkClick` events from the website.
20. **No additional channels:** Do not add WhatsApp, SMS, or any other messaging channels.

### Admin & Architecture

21. **Server-side admin checks:** Admin routes must verify `user.isAdmin === true` on the server for every request. Initial admin is provisioned via `INITIAL_ADMIN_EMAIL` or `npm run db:seed`.
22. **Strictly 4 admin screens:** Build only the 4 screens in the PRD:
    - Submission Queue
    - Flagged Listings
    - Ingestion Health
    - Tagging Audit (evaluation only; does not mutate live tags)
23. **No vector databases:** Do not implement vector databases, embeddings, or `pgvector` in the MVP. Search is standard PostgreSQL text search.

### Security & Data

24. **No secrets in version control:** Never commit API keys, connection strings, or credentials. Use `.env` files.
25. **Privacy:** Never log user email addresses or tokens in plain text.
26. **No destructive DB commands:** Never run `drop`, `truncate`, or `reset` on shared databases. All schema updates require Prisma migrations.
27. **Preserve schema meaning:** Do not alter existing Prisma enums or fields without an approved migration.

### Working Conduct

28. **No unapproved features:** Do not add scope outside the PRD.
29. **Verify before claiming:** Do not state something works without executing and testing it.
30. **Explicit assumptions:** Document every assumption clearly in responses and code comments.

---

## 3. Negotiable Actions

The following can be adjusted provided they remain simple, documented, and consistent:

- **Code & Structure:** Folder organization, utility libraries (well-maintained, non-redundant), internal naming, and test layouts.
- **Interface & Styling:** Component layout, color tokens, and spacing (must remain fast, clean, and mobile-first).
- **Configuration:**
  - Retry wait duration between Apify attempts.
  - Ingestion schedule hour during development.
  - Starter keyword additions in `worker/keywords.py` (4-tier scoring rules and negative-precedence logic remain non-negotiable).
  - Database index additions supported by real query profiles.
- **Development Workflow:** Branch naming, commit sizing, and test seed data.

---

## 4. When to Stop and Ask

Stop immediately and consult the owner if:

- A task requires a new paid service, infrastructure component, or library outside the locked stack.
- A task impacts data sourcing legality or anti-bot boundaries.
- A task alters the 4-tier tagging logic, flag threshold (3 flags), or notification rules.
- A task modifies or deletes data in a shared database.
- You cannot determine whether an action is negotiable or non-negotiable.

---

## 5. Definition of Done

A task is complete only when:

1. The code runs and the exact test verification steps are stated.
2. Any schema modifications have a clean Prisma migration.
3. No secrets or credentials exist in the diff.
4. All non-negotiable rules are satisfied.
5. All assumptions made are explicitly stated.
