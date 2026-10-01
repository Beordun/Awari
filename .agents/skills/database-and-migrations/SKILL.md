---
name: database-and-migrations
description: >-
  Procedures for managing PostgreSQL schemas via Prisma migrations, index optimization,
  and initial admin account provisioning.
---

# Database & Migrations Runbook

This skill outlines PostgreSQL database operations, Prisma migrations, and security constraints.

## 1. Schema Management via Prisma

* **Location:** `prisma/schema.prisma`
* **Workflow:**
  1. Make schema adjustments in `prisma/schema.prisma`.
  2. Generate migration: `npx prisma migrate dev --name <descriptive_name>`.
  3. Validate client generation: `npx prisma generate`.

> **CRITICAL RULE:** Never execute destructive commands (`drop`, `truncate`, `reset`) against shared or production databases. Never edit PostgreSQL schema manually outside Prisma migrations.

## 2. Admin Bootstrapping

To bootstrap the first admin account without exposing vulnerable public endpoints:
1. Set the environment variable:
   ```env
   INITIAL_ADMIN_EMAIL="owner@awari.co.uk"
   ```
2. The seed script `prisma/seed.ts` upserts the admin user:
   ```typescript
   import { PrismaClient, UserStatus } from '@prisma/client';
   const prisma = new PrismaClient();

   async function main() {
     const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
     if (adminEmail) {
       await prisma.user.upsert({
         where: { email: adminEmail },
         update: { isAdmin: true },
         create: {
           email: adminEmail,
           isAdmin: true,
           status: UserStatus.ACTIVE,
         },
       });
     }
   }
   main();
   ```
3. Run via `npm run db:seed`.

## 3. Direct Python Connection Rules

The Railway Python worker connects directly to PostgreSQL:
* Use `psycopg2-binary` or `SQLAlchemy`.
* Connection string is read from `DATABASE_URL`.
* Always use parameterized queries to prevent SQL injection.
