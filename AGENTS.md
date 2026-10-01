# AGENTS.md: Awari

This file tells any AI coding agent how to work on Awari. Read it before you write code. The source of truth for product decisions is `Awari-PRD-v2.md`. If this file and the PRD disagree, stop and ask the owner.

## Project in one paragraph

Awari helps skilled workers in the UK find genuine sponsored roles in the NHS, Civil Service, MoJ, and Councils. It ingests listings through Apify actors, tags each one with a sponsorship-likelihood signal, and delivers new listings through a website, four Telegram channels, and one daily email digest.

## Locked stack

Next.js (App Router), TypeScript, Prisma, NextAuth / Auth.js (Email Magic Links via Resend), PostgreSQL, Python (with psycopg2-binary or SQLAlchemy), Apify, Telegram Bot API, Resend. Frontend on Vercel. Python worker on Railway.

Do not add a new framework, service, database, queue, or paid tool without approval from the owner.

---

## Non-negotiable actions

You must follow every rule in this list. Do not bend them, even if a task seems to justify it. If a task cannot be done without breaking one, stop and report why.

### Data sourcing
1. Do not write your own scraper for NHS Jobs, Civil Service Jobs, or Find a Job. Job data enters the system only through Apify actors or through user submissions.
2. Do not use LinkedIn or Jobrapido as a source, in any form.
3. Do not use an AI model (Claude, GPT, Gemini or any other) to find, search for, recall, or generate job listings. A model may only read text that a real fetch has already returned.
4. Never invent, fill in, or guess listing data. Do not write placeholder employers, salaries, or closing dates into any production path. Test data must be clearly labelled as test data and must never reach production.
5. Do not add code that tries to defeat an anti-bot check directly. Any such access stays inside the Apify actor and under the legal review gate in the PRD.

### Trust and moderation
6. A user-submitted URL must pass the strict domain whitelist at submission time (`hostname === 'gov.uk' || hostname.endsWith('.gov.uk') || hostname === 'nhs.uk' || hostname.endsWith('.nhs.uk')`). Reject everything else automatically.
7. A user-submitted listing must never publish without admin approval. In the admin Submission Queue, the admin enters/verifies job details (title, department, employer, location, salary, description). On approval, the listing is created with `isPublished = true`, tagged, and immediately posted to the appropriate Telegram channel.
8. When a listing reaches three flags, set `isPublished = false` immediately and remove it from any pending notification batch. It stays hidden from public queries (which must always filter `where: { isPublished: true }`) until an admin restores it.
9. Every listing tag is a likelihood, never a guarantee. Do not word any interface text, email, or Telegram message to suggest that a role definitely offers sponsorship.
10. Do not present anything as legal or immigration advice.

### Pipeline rules
11. Sponsorship tagging runs in the Python worker (and on admin user-submission approval in Next.js), after deduplication and before the write to PostgreSQL. Do not move it elsewhere. Evaluation checks the Home Office register of licensed sponsors and the keyword list, with explicit negative phrases ("no visa sponsorship", "unable to sponsor", etc.) strictly overriding all other signals to assign `NOT_SPONSORED`.
12. Deduplicate on the listing's canonical source URL (strip tracking query parameters `utm_*`, `ref`, etc., strip trailing slashes, and lowercase scheme and domain). Do not create duplicate listing rows.
13. If an Apify actor call fails, retry once. If it fails again, log `RunStatus.FAILED` in `IngestionRun` and alert the admin by email. Never skip a source silently. Every run must write an `IngestionRun` row.
14. If the Apify usage cap is reached, stop ingestion for that cycle, log it in `IngestionRun`, alert the admin, and show the delay notice banner on the website based on the latest `IngestionRun` status. Do not raise or remove the cap in code.
15. Ingestion runs once a day during development. Do not increase frequency until the success metrics in the PRD are met.

### Notifications
16. Send one email digest per user per day, fixed at 07:00 UK time. Enforce daily delivery idempotency by checking existing `Notification` records (`channel = EMAIL`, `sentAt >= CURRENT_DATE`). Never send more than one per user per day.
17. Post to four separate Telegram channels only: NHS, Civil Service, MoJ, and Council. Python worker dispatches newly ingested listings upon cycle completion; Next.js server action dispatches approved user submissions upon admin approval. Do not merge them or add more.
18. Do not build per-user notification filtering. Filtering happens on the website only.
19. Do not attempt to read or store Telegram channel membership. Log only the `TelegramLinkClick` signal described in the PRD.
20. Do not add WhatsApp or any other notification channel.

### Admin and access
21. Admin routes must check the `isAdmin` flag on the server for every request. Never rely on hiding a link in the interface. Initial admin is provisioned via the `INITIAL_ADMIN_EMAIL` environment variable or `npm run db:seed`; never create public endpoints that set `isAdmin`.
22. Build only the four admin screens in the PRD: submission queue, flagged listings, ingestion health, tagging audit. Do not add analytics, bulk actions, roles, or extra screens. The tagging audit screen strictly logs `TagAudit` records for the Section 12 evaluation; it does not mutate live listing tags.
23. Do not build a vector database or embeddings in the MVP. The PRD defers it.

### Security and data
24. Never commit secrets, API keys, tokens, or connection strings. Use environment variables and keep `.env` files out of version control.
25. Do not log user email addresses or tokens in plain text.
26. Do not run destructive database commands (drop, truncate, reset) against any shared or production database. Use Prisma migrations for every schema change. Do not edit the database by hand.
27. Do not change the meaning of existing enums or fields in the Prisma schema without a migration and a note to the owner.

### Working conduct
28. Do not add features that are not in the PRD. If you think something is missing, propose it in writing and wait.
29. Do not state that something works unless you ran it. Report what you tested and what you did not.
30. Flag every assumption you make. Mark it clearly in your reply and in a code comment where relevant.

---

## Negotiable actions

You may make these choices yourself. Keep them simple, explain them briefly in your summary, and stay consistent with existing code. The owner can override any of them.

### Code and structure
- Folder layout and file naming, provided it stays consistent.
- Choice of small utility libraries, provided they are well maintained and do not duplicate something already in the stack.
- Linting and formatting rules.
- Testing framework and test layout, provided core pipeline logic and the tagging rules have tests.
- Python packaging approach for the worker (for example `requirements.txt` or `pyproject.toml`).
- Internal function and variable names.

### Interface
- Visual styling, component library, colours, and spacing, provided the interface stays plain, fast, and readable on a phone.
- Page layout of the listing feed, filter controls, and search box.
- Pagination size for listings.
- Wording of empty states and error messages, provided they follow rule 9 and rule 10.
- The design and wording of the email digest template, provided it stays one email per day.

### Configuration
- Retry wait time between the first Apify attempt and the retry.
- Ingestion run time of day during development.
- The starter keyword list for sponsorship tagging in `worker/keywords.py`. Extend or adjust it, keep it in one clearly named file, and record each change in the commit message. The 4-tier scoring rule and negative phrase precedence are non-negotiable and require approval to change.
- Log format and log levels.
- Database index choices, provided they are justified by a real query.

### Ways of working
- Commit size and branch naming.
- Whether to split a large task into smaller pull requests.
- Seed and fixture data for local development, provided it is labelled as test data.

---

## When to stop and ask the owner

Stop and ask before you act if:
- A task needs a new paid service, new infrastructure, or a new dependency in the locked stack.
- A task touches the legal risk of data sourcing.
- A task changes the tagging scoring rule, the notification rules, or the flag threshold.
- A task would change or delete existing data in a shared database.
- You cannot tell whether a choice is negotiable or non-negotiable. Treat it as non-negotiable until told otherwise.

## Definition of done

A task is done only when:
- The code runs and you have said exactly what you tested.
- Schema changes have a Prisma migration.
- No secrets are in the diff.
- No rule in the non-negotiable list is broken.
- Any assumption you made is stated.
