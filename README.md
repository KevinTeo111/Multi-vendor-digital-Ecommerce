# Digital Marketplace

Multi-vendor e-commerce platform for digital products (inspired by CodeCanyon).

## Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Web      | Next.js 15 (App Router), React 19, Tailwind 4        |
| API      | NestJS 11, TypeScript, class-validator               |
| Database | PostgreSQL + Prisma 6 (Rust-free: pg driver adapter) |
| Cache    | Redis (reserved for sessions/jobs)                   |
| Storage  | S3-compatible (Cloudflare R2 / S3 / MinIO)           |
| Payments | Pagar.me v5 gateway adapter + mock gateway           |

## Repository layout

```text
apps/api          NestJS API (REST under /api)
apps/web          Next.js storefront, vendor dashboard, admin dashboard
packages/shared   Dependency-free constants and money helpers used by both apps
docker-compose.yml  Postgres, Redis, MinIO (with bucket bootstrap)
```

## Getting started

You need a PostgreSQL database and an S3-compatible bucket. Either use hosted free tiers (Neon +
Cloudflare R2, no Docker needed) or run `npm run infra:up` to start Postgres and MinIO locally with
Docker. Put the connection details in `.env`.

```bash
cp .env.example .env             # fill DATABASE_URL, S3_* and secrets
npm install
npm run build -w packages/shared
npm run db:generate
npm run db:deploy                # applies prisma/migrations
npm run db:seed                  # admin user, 3 plans, categories, settings
npm run db:seed:demo             # optional demo seller, products and buyer
npm run dev:api                  # http://localhost:4000/api
npm run dev:web                  # http://localhost:3000
```

Seeded admin: `admin@marketplace.local` / `Admin123!` (override with
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

The API reads the repo-root `.env`. Next.js reads `apps/web/.env.local`; the defaults
(`NEXT_PUBLIC_API_URL=http://localhost:4000`) work without one.

### Local end-to-end walkthrough (mock gateway)

1. Register as a vendor at `/register`, pick a plan at `/vendor/subscription` (free plan activates instantly).
2. Create a product at `/vendor/products/new`, upload a thumbnail and a file, submit for review.
3. Sign in as the seeded admin, approve it at `/admin/products`.
4. Register a buyer, add to cart, pay (`/cart` → mock gateway marks it paid immediately), download from `/library`.
5. Vendor sees the sale under `/vendor/finance` as a pending credit; lower `finance.pending_hold_days`
   in `/admin/settings` to 0 to make it available immediately, then request a withdrawal.
6. Admin approves at `/admin/withdrawals`. In the default **manual payout mode** the admin then sends
   the money by PIX or bank transfer and clicks **Mark as paid**. Switching `finance.payout_mode` to
   `gateway` makes approval trigger a transfer through the payment provider instead.

### Demo content

```bash
npm run db:seed:demo
```

Creates the seller **Creative Studio** (`demo-seller@marketplace.local`) with an active Pro plan, eight
approved products with thumbnails and downloadable files in object storage, an available balance, and
the buyer `demo-buyer@marketplace.local` with a paid order. Password for both: `Demo1234!`. Re-running
the command resets the demo accounts.

## Core business rules

- **Money** is stored as integer cents. Commission rates are basis points (2000 = 20%).
- **Plans** define the commission rate, the maximum number of listed products and the number of
  withdrawal requests allowed per rolling 7 days (default 1; the amount is not capped).
- **Sales are not split at the gateway.** The platform receives the full payment. Each paid order item
  creates a `PENDING` ledger credit for the vendor's net amount, which becomes `AVAILABLE` after the
  configurable hold period.
- **Withdrawals** can be requested only when the available balance reaches the admin-defined minimum,
  the plan's weekly request allowance is not used up, no other withdrawal is open, and payout details
  are on file. The request places a ledger hold; admin approval triggers the gateway transfer;
  rejection or transfer failure releases the hold.
- **Products** are created as `DRAFT`, submitted to `PENDING_REVIEW` (requires a file, a thumbnail,
  an entitling subscription and room under the plan limit), and are visible only once an admin sets
  them to `APPROVED`. Admins can block; vendors can unpublish and republish.
- **Order items snapshot** the price and commission rate at purchase time so plan changes never
  rewrite history.
- **Downloads** are served through short-lived signed URLs tied to a paid order item, and logged.
- **Uploads** go directly from the browser to object storage with presigned URLs; the API verifies
  the object (size, type) before recording it.
- **Webhooks** are stored by `(provider, eventId)` and processed exactly once.

## Realtime and languages

- **Realtime**: the API exposes a Socket.IO namespace at `/realtime`, authenticated with the same access
  token as the REST API. Sellers receive `product.status`, `withdrawal.status` and `sale.new`; buyers
  receive `order.paid`; admins receive `product.submitted` and `withdrawal.requested`. The web app shows
  toasts and refreshes the affected lists in place, so an approval appears on the seller's screen without
  a reload. CORS for the socket uses `WEB_URL`, like the REST API.
- **Languages**: Portuguese (Brazil) is the default, English is available from the header toggle. The
  choice is stored in a `locale` cookie so server-rendered pages translate too. Dictionaries live in
  `apps/web/src/i18n/dictionaries`; every key in `en.ts` must exist in `pt-BR.ts` (enforced by the type).
  API validation messages are not translated yet.

## API surface (all under `/api`)

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Public catalog | `GET /products`, `/products/:slug`, `/categories`, `/plans`, `/vendors/:slug`, `/settings/public` |
| Buyer | `GET/POST/DELETE /cart…`, `POST /checkout`, `GET /orders`, `/orders/:id`, `/orders/library`, `/orders/items/:id/download` |
| Vendor | `/vendors/me`, `/vendor/products…` (CRUD, files, images, submit, unpublish), `/vendor/subscription`, `/vendor/sales`, `/vendor/sales/:itemId`, `/vendor/finance/{balance,ledger,withdrawals,withdrawals/eligibility}` |
| Realtime | Socket.IO namespace `/realtime` (token in handshake `auth.token`) |
| Admin | `/admin/{users,vendors,products,orders,plans,categories,subscriptions,settings}`, `/admin/finance/{summary,withdrawals,vendors/:id/ledger}` |
| Webhooks | `POST /webhooks/payments` |

## Database notes

- Prisma runs in Rust-free mode (`queryCompiler` + `driverAdapters` with `@prisma/adapter-pg`), so no
  native engine binary is used at runtime. This was required because Prisma's native engines crash on
  some Windows machines with exception `0xC000001D`.
- `npm run db:deploy` applies `prisma/migrations` through a small pg-based runner that writes the same
  `_prisma_migrations` table Prisma uses, so `prisma migrate deploy` stays interchangeable on servers.
- To create a new migration without the native engine, keep a copy of the previous schema and diff:
  `npx prisma migrate diff --from-schema-datamodel prisma/schema.prev.prisma --to-schema-datamodel prisma/schema.prisma --script`
  then save the output as `prisma/migrations/<timestamp>_<name>/migration.sql`.
- Neon: use the direct host (no `-pooler`) and remove `channel_binding=require` from the URL.
- Interactive transactions default to a 30 s timeout (see `src/prisma/adapter.ts`) because remote
  databases add latency to every round trip.

## Code quality

```bash
npm run format:check        # Prettier (npm run format to fix)
npm run typecheck           # all workspaces
npm test -w apps/api        # unit tests (money, withdrawal rules, product lifecycle, settings, pagination, Stripe webhooks, module wiring)
npm run build               # all workspaces
```

The same four steps run in GitHub Actions on every push and pull request (`.github/workflows/ci.yml`).

Conventions that keep the code easy to change:

- **One responsibility per service.** `CheckoutService` owns order creation and the PENDING → PAID/FAILED
  transitions; `OrdersService` only reads. `ProductsService` delegates every status change to the
  transition table in `product-status.ts`.
- **Request validation lives in `dto/` files**, never inline in controllers.
- **Lists use `findPage` / `mapPage`** (`common/dto/pagination.dto.ts`) instead of hand-written
  query-plus-count pairs.
- **Signed media URLs come from `StorageService.withThumbnail` / `withProductMedia`.**
- **Configuration is parsed once** in `config/env.ts` (`webOrigins`, `primaryWebUrl`); modules never
  re-parse environment variables.
- **The payment provider is an interface** (`payments/gateway/payment-gateway.interface.ts`); adapters are
  the only files that import a provider SDK.
- **Web:** pages call the API through `lib/api.ts` and `useFetch`/`useAction`; UI primitives live in
  `components/ui.tsx`; all user-visible text goes through the dictionaries in `i18n/`.

## Deployment notes

- API on Render (free instance): build command
  `npm ci --include=dev && npm run build -w packages/shared && npm run prisma:generate -w apps/api && npm run build -w apps/api`,
  start command `node apps/api/dist/main.js`, health check `/api/health`, env vars as listed in `render.yaml`.
  `--include=dev` is required because `NODE_ENV=production` makes npm skip the build tools otherwise.
  Run migrations from a developer machine: `DATABASE_URL="<prod>" npm run migrate:apply -w apps/api`.
- Web on Vercel: root directory `apps/web`, env `NEXT_PUBLIC_API_URL` and `API_URL` set to the API base URL
  (no trailing slash, no `/api`). Then set `WEB_URL` on Render to the Vercel site URL and add that URL to the
  R2 bucket CORS policy.

## Payment gateway

`PAYMENT_GATEWAY=mock` (default) completes every payment, subscription and transfer instantly.
`PAYMENT_GATEWAY=stripe` uses `apps/api/src/modules/payments/gateway/stripe.gateway.ts`:

- Orders use Stripe Checkout in payment mode. Payment methods are whatever is enabled in the Stripe
  dashboard (card, Pix and boleto for a Brazilian account). The order stores the Checkout Session id;
  `checkout.session.completed` / `async_payment_succeeded` mark it paid, `async_payment_failed` /
  `expired` mark it failed.
- Paid plans use Stripe Checkout in subscription mode. The adapter creates a Stripe Price per plan
  on first use (`syncPlan`) and recreates it when the admin changes the price or interval. The
  subscription row first holds the session id; the webhook swaps in the real `sub_…` id and the
  billing period. `invoice.paid` renews, `invoice.payment_failed` sets past due,
  `customer.subscription.deleted` cancels. Cancelling sets `cancel_at_period_end`, so access lasts
  until the paid period ends. Free plans never touch Stripe.
- Payouts stay manual (admin pays by PIX or bank transfer and marks the withdrawal paid). Automated
  payouts would use Stripe Connect and are a Phase 2 item.
- Webhook endpoint: `POST /api/webhooks/payments`, verified with `STRIPE_WEBHOOK_SECRET` against the raw
  body. Events to subscribe: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.deleted`.

Required variables: `STRIPE_SECRET_KEY` (`sk_test_…` / `sk_live_…`) and `STRIPE_WEBHOOK_SECRET` (`whsec_…`).
Nothing Stripe-related is exposed to the browser.

## Not in the MVP (planned next)

- Email notifications (product approved/rejected, order paid, withdrawal status).
- Background jobs on Redis/BullMQ (ledger release, subscription expiry, webhook replay).
- Reviews and ratings, licenses (regular/extended), refunds, coupons, multi-currency.
- Server-side rendering of authenticated pages with cookie sessions (currently JWT in the browser).
- Public CDN bucket for thumbnails instead of signed media URLs.
