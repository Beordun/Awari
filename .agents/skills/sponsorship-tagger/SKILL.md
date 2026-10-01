---
name: sponsorship-tagger
description: >-
  Instructions and deterministic procedures for evaluating UK public sector job listings
  for visa sponsorship likelihood against the Home Office register of licensed sponsors
  and explicit negative/positive keyword rules.
---

# Sponsorship Tagging Runbook

This skill defines the exact logic for evaluating whether a vacancy is likely to offer visa sponsorship. It is executed in the Python worker on batch ingestion and in Next.js Server Actions on user-submission approval.

## 1. Tagging Tiers

Every listing receives exactly one of four tags:
* `LIKELY_SPONSORED`: Employer is in the Home Office register of licensed sponsors AND the job description contains a positive sponsorship keyword.
* `POSSIBLY_SPONSORED`: Either the employer is in the register OR a positive keyword is found in the description, but not both.
* `UNCLEAR`: Neither condition is met.
* `NOT_SPONSORED`: The job description contains an explicit negative sponsorship phrase.

## 2. Precedence & Evaluation Order

Evaluation MUST follow this strict order:

```
[Job Description & Employer Input]
               │
               ▼
   Contains Negative Phrase?  ────────► YES ──► NOT_SPONSORED (Strict Override)
               │
               ▼ NO
               │
 ┌─────────────┴─────────────┐
 │                           │
 ▼                           ▼
Register Match?       Positive Keyword?
 │                           │
 └─────────────┬─────────────┘
               │
      Both match? ────────► YES ──► LIKELY_SPONSORED
               │ NO
      Either match? ──────► YES ──► POSSIBLY_SPONSORED
               │ NO
               ▼
            UNCLEAR
```

> **CRITICAL RULE:** Negative phrases (e.g., "no visa sponsorship", "unable to sponsor") take absolute precedence over any positive signals. If a job description says "We cannot sponsor Skilled Worker visas", it MUST be tagged `NOT_SPONSORED` even though it contains "Skilled Worker visa".

## 3. Negative Phrases (Strict Override)

Any match assigns `NOT_SPONSORED`:
* `"no visa sponsorship"`
* `"unable to sponsor"`
* `"cannot sponsor"`
* `"not eligible for sponsorship"`
* `"does not offer sponsorship"`
* `"sponsorship is not available"`
* `"must have the existing right to work in the uk"`

## 4. Positive Keywords

* `"visa sponsorship available"`
* `"visa sponsorship offered"`
* `"skilled worker visa"`
* `"certificate of sponsorship"`
* `"cos available"`
* `"will sponsor"`
* `"sponsorship considered"`

## 5. Home Office Register Matching

1. **Dataset:** Source from the official Home Office Public Register of Worker and Temporary Worker licensed sponsors.
2. **Normalization:**
   * Convert strings to lowercase.
   * Strip non-alphanumeric characters.
   * Strip standard UK legal suffixes: `ltd`, `limited`, `plc`, `cic`, `llp`, `nhs trust`, `nhs foundation trust`.
3. **Lookup:** Perform exact lookup on normalized entity names.

## 6. Implementation Locations
* Python worker implementation: `worker/tagger.py` and `worker/keywords.py`
* Next.js user-submission implementation: `lib/tagger.ts`
* Unit tests: `tests/test_tagger.py` (Python) and `__tests__/tagger.test.ts` (TypeScript)
