---
name: apify-ingestion-worker
description: >-
  Procedures for managing the scheduled Python worker on Railway: invoking Apify actors
  for NHS Jobs, Civil Service Jobs, and Find a Job, deduplicating canonical URLs, and
  logging run status to PostgreSQL.
---

# Apify Ingestion Worker Runbook

This skill governs the Python worker hosted on Railway that ingests public sector vacancies into PostgreSQL.

## 1. Data Sources & Target Boards
* **NHS Jobs:** Scraped via dedicated Apify actor.
* **Civil Service Jobs:** Scraped via dedicated Apify actor.
* **Find a Job (DWP / Councils):** Scraped via dedicated Apify actor.

> **RULE:** Never write custom scrapers or attempt to bypass ALTCHA directly. All automated ingestion occurs through managed Apify actors.

## 2. Ingestion Pipeline Steps

For each source board:
1. **Trigger Apify Actor:** Call the Apify client with predefined dataset parameters and memory limits.
2. **Handle Failure / Retries:**
   * If the actor run fails, retry once after a 30-second delay.
   * If it fails again, log `RunStatus.FAILED` in `IngestionRun` and dispatch an email alert to the admin via Resend.
   * Never skip a source silently.
3. **Usage Cap Guard:**
   * Check Apify consumption against the monthly spend cap.
   * If the cap is reached, halt ingestion for the cycle, record the status in `IngestionRun`, notify the admin, and let the website display the delay banner.
4. **Canonical URL Deduplication:**
   For each item returned:
   ```python
   def canonicalize_url(raw_url: str) -> str:
       # 1. Parse URL
       # 2. Strip tracking query params (utm_*, ref, source, fbclid, etc.)
       # 3. Strip trailing slashes
       # 4. Lowercase scheme and domain
       return cleaned_url
   ```
   Query `Listing.sourceUrl` in PostgreSQL. If it exists, skip insertion.
5. **Tagging:** Pass the cleaned title, description, and employer through `sponsorship-tagger`.
6. **Persistence:** Insert into `Listing` via `psycopg2-binary` or `SQLAlchemy`.
7. **Telegram Broadcast:** For each newly inserted listing, push immediately to the appropriate Telegram channel (`NHS`, `CIVIL_SERVICE`, `MOJ`, or `COUNCIL`).
8. **Audit Logging:** Write an `IngestionRun` record with `itemsIngested`, `status`, and `runAt`.

## 3. Worker Configuration & Environment
Required environment variables on Railway:
* `DATABASE_URL`: PostgreSQL connection string.
* `APIFY_TOKEN`: API token with read permissions.
* `RESEND_API_KEY`: For admin failure alert emails.
* `ADMIN_EMAIL`: Destination for failure and budget alerts.
* `TELEGRAM_BOT_TOKEN`: Bot token for channel posting.
* `TELEGRAM_CHANNEL_NHS`, `TELEGRAM_CHANNEL_CIVIL_SERVICE`, etc.
