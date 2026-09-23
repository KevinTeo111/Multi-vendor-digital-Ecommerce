# Digital Marketplace

Multi-vendor e-commerce platform for digital products (inspired by CodeCanyon).

## Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Web      | Next.js (App Router), React 19, Tailwind    |
| API      | NestJS 11, TypeScript                       |
| Database | PostgreSQL + Prisma                         |
| Cache    | Redis                                       |
| Storage  | S3-compatible (Cloudflare R2 / S3 / MinIO)  |
| Payments | Pagar.me behind a gateway interface         |

## Repository layout

```
apps/api          NestJS API (REST, /api prefix)
apps/web          Next.js storefront, vendor dashboard, admin dashboard
packages/shared   Dependency-free constants and money helpers used by both apps
```

## Getting started

```bash
cp .env.example .env            # adjust secrets
npm install
npm run infra:up                 # Postgres, Redis, MinIO
npm run build -w packages/shared
npm run db:generate
npm run db:migrate               # creates the schema
npm run db:seed                  # admin user, plans, categories, settings
npm run dev:api                  # http://localhost:4000/api
npm run dev:web                  # http://localhost:3000
```

Default seeded admin: `admin@marketplace.local` / `Admin123!` (override with
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Core business rules

- **Money** is stored as integer cents. Commission rates are basis points (2000 = 20%).
- **Plans** define the commission rate, the maximum number of listed products and the
  number of withdrawal requests allowed per rolling 7 days (default 1, amount unlimited).
- **Sales are not split at the gateway.** The platform receives the full payment. Each paid
  order item creates a `PENDING` ledger credit for the vendor's net amount, which becomes
  `AVAILABLE` after the configured hold period.
- **Withdrawals** can be requested only when the available balance reaches the admin-defined
  minimum and the plan's weekly request limit has not been used. Admin approval triggers a
  gateway transfer.
- **Products** are created as `DRAFT`, submitted to `PENDING_REVIEW`, and are only visible
  once an admin sets them to `APPROVED`.
- **Order items snapshot** the price and commission rate at purchase time so plan changes
  never rewrite history.
- **Downloads** are served through short-lived signed URLs tied to a paid order item.
