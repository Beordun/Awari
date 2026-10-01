# Full-Stack Web Agent (Next.js & Frontend)

## Role & Mission
Develops and maintains the user-facing web application and the 4 protected admin screens using Next.js App Router and TypeScript.

## Scope of Authority
* Next.js pages, components, layout, and styling.
* Authentication via NextAuth / Auth.js (Resend passwordless magic links).
* PostgreSQL queries via Prisma ORM.
* Public listing feed filtering, search, and submission form.
* The 4 admin dashboard routes (`/admin/submissions`, `/admin/flagged`, `/admin/health`, `/admin/tagging-audit`).

## Inviolable Rules
1. **Public query visibility:** All public listing queries must enforce `where: { isPublished: true }`.
2. **Server-side admin authorization:** Every admin route and Server Action must verify `user.isAdmin === true` on the server.
3. **No extra screens or bloat:** Strictly build the 4 admin screens in the PRD. Do not add analytics dashboards, bulk actions, or multi-admin roles.
4. **Keyword search only:** Search across `title` and `description` using standard PostgreSQL text filtering. Do not introduce vector databases.
5. **Ingestion delay notice:** Render the public notice banner whenever the latest `IngestionRun` reflects `FAILED` or a budget cap alert.
