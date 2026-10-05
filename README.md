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
   In manual mode the platform never contacts Mercado Pago for payouts: **Mark as paid** records a
   transfer the admin already made outside the platform, so no webhook or provider event follows.
   The admin screen requires the PIX end-to-end ID or bank receipt number, shows it on the withdrawal,
   and flags any older withdrawal recorded without one. Every withdrawal step is a single conditional
   update (`WithdrawalsService.transition`): two admins or a double click can never both apply, so a
   withdrawal can never be paid and have its hold released. Each step is written to the server log.
   Gateway mode needs the provider's payout API; Mercado Pago's adapter does not implement it yet.

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

## Accounts and passwords

- `POST /auth/forgot-password` answers the same for every e-mail (no account discovery) and sends a
  reset link valid for 30 minutes. `POST /auth/reset-password` sets the new password and revokes every
  session. `POST /auth/change-password` needs the current password, signs out every other device and
  returns a fresh token pair for the current one.
- Reset tokens are signed JWTs (own key, derived from `JWT_REFRESH_SECRET`) carrying a fingerprint of
  the password hash they were issued for. Changing the password changes the fingerprint, so each link
  works once and every older link dies with it. No table, no cleanup job.
- The reset link is e-mailed (see **Automatic e-mails**). Admins can also generate a link from
  **Admin → Users → Reset link** and hand it to the user privately (not available for admin accounts).

## Automatic e-mails

Sent through Brevo's transactional API when `BREVO_API_KEY` and `MAIL_FROM_EMAIL` are set
(`apps/api/src/modules/mail`). Without a key nothing is sent: development logs the message,
production logs only that it was skipped (a reset link must never reach the logs).

| E-mail | To | When |
| --- | --- | --- |
| Password reset | the account | `POST /auth/forgot-password` |
| Order confirmed (items, purchase codes, total) | buyer | the payment is confirmed |
| Order refunded | buyer | an admin refunds the order (not sent for chargebacks) |
| Product approved / not approved / blocked | seller | the admin decision |
| Withdrawal approved / paid / rejected / failed | seller | each withdrawal step |

- Each e-mail is triggered once, at the same point as the realtime notification, after the change is
  committed. Sending runs in the background: a provider failure is logged and never undoes or delays
  the payment, review or withdrawal. There is no retry queue.
- Texts are in Brazilian Portuguese (`templates.ts`); `MAIL_FROM_NAME` is the brand shown in the
  sender, header and footer. In Brevo the sender address must be a verified sender, and the domain
  should be authenticated (DKIM/DMARC) so messages do not land in spam.

## Background jobs and limits

- In-process timers, no Redis: one instance needs no queue, and every job reuses the same idempotent
  transitions as the webhooks, so a double run is harmless. Disable with `JOBS_ENABLED=false`.
  - Every 30 min: pending orders older than 15 min are checked with the provider (lost webhook → PAID,
    refused → FAILED, untouched past the 24 h checkout window → "Checkout expired").
  - Every hour: pending seller plans are checked the same way; canceled plans whose paid period ended
    become EXPIRED.
  - Every 5 min (ledger): held sale credits whose hold period ended become available.
- Rate limits per client IP, writes only (reads are skipped because the web app's server-side
  rendering shares a few Vercel IPs): 120 writes/min by default, login and register 10/min,
  password reset and change 5/min. Payment webhooks and `/api/health` are never limited.
- Security headers via helmet.

## Reviews, coupons and licences

- **Licences.** Every product has a Regular licence; a seller may add an optional Extended licence
  with its own base price (the buyer price includes the provider fee, like the Regular one). The cart
  stores the licence per item and falls back to Regular if the seller withdraws the Extended price.
- **Purchase codes.** Each order item gets a unique code (`XXXX-XXXX-XXXX-XXXX`) shown in the
  buyer's library. Sellers check a code under Vendor → Licence check; a refunded sale shows as revoked.
- **Reviews.** Only a buyer of a paid item can rate it (1–5 stars, optional comment, editable). The
  seller can reply once per review (editable); the admin can hide and restore reviews. Product
  rating is kept as a running sum and count of visible reviews. A refund deletes the item's review.
- **Coupons.** Admin coupons are funded by the platform (taken from commission); seller coupons only
  apply to that seller's products and are funded from the seller's net (never below zero). A coupon
  can be limited to one seller or product, a minimum order, a period, a total number of uses and a
  number of uses per buyer (pending and paid orders both count, so a buyer can't stack unpaid
  checkouts). The discount is split across eligible items and every order still charges at least
  R$ 1,00. The cart previews the discount with `POST /checkout/preview` using the same pricing code
  as `POST /checkout`.

## API surface (all under `/api`)

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Public catalog | `GET /products`, `/products/:slug`, `/products/:slug/reviews`, `/categories`, `/plans`, `/vendors/:slug`, `/settings/public` |
| Buyer | `GET/POST/DELETE /cart…`, `POST /reviews`, `POST /checkout`, `/checkout/preview`, `GET /orders`, `/orders/:id`, `/orders/library`, `/orders/items/:id/download` |
| Vendor | `/vendors/me`, `/vendor/products…` (CRUD, files, images, submit, unpublish), `/vendor/subscription`, `/vendor/sales`, `/vendor/sales/:itemId`, `/vendor/sales/verify?code=`, `/vendor/{reviews,coupons}…`, `/vendor/finance/{balance,ledger,withdrawals,withdrawals/eligibility}` |
| Realtime | Socket.IO namespace `/realtime` (token in handshake `auth.token`) |
| Admin | `/admin/{users,vendors,products,orders,plans,categories,subscriptions,settings,reviews,coupons}`, `/admin/finance/{summary,withdrawals,vendors/:id/ledger}` |
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
npm test -w apps/api        # unit tests (money, withdrawal rules, product lifecycle, settings, pagination, Mercado Pago webhooks, module wiring)
npm run build               # all workspaces
```

The same four steps run in GitHub Actions on every push and pull request (`.github/workflows/ci.yml`).

The integration test (`apps/api/src/integration`) drives cart → checkout → signed Mercado Pago webhook →
PAID → download against a real Postgres. It runs when `TEST_DATABASE_URL` is set (CI starts a disposable
`postgres:16` container) and is skipped otherwise. It wipes that database, so it refuses hosted (Neon/Render) URLs.

Conventions that keep the code easy to change:

- **Responsive by default (web).** Pages are built from the primitives in `components/ui.tsx`, which
  carry the mobile behaviour: `Table` turns each row into a labelled card below `md` (headers are
  passed to every `Td` automatically), `FilterBar` stacks search and filters full width on phones,
  `ListRow` puts date and reference above the title, `Modal` scrolls inside short screens, and form
  controls use 16px text on phones so iOS does not zoom. Centered page containers use
  `mx-auto w-full max-w-*`: without `w-full` a child of the flex-column layout shrinks to its widest
  content and the page scrolls sideways.
- **List pages use `usePagedList`** (`lib/use-fetch.ts`): one call holds the page, the filters and
  the fetch, leaves empty filters out of the query and returns to page 1 when a filter changes.
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
The adapters live in `apps/api/src/modules/payments/gateway/` behind one `PaymentGateway` interface;
the rest of the API never imports a provider SDK.

### Mercado Pago (production choice: Pix from day one)

`PAYMENT_GATEWAY=mercadopago` uses `mercadopago.gateway.ts` (REST API through `fetch`, no SDK):

- Orders use Checkout Pro. A Preference is created with the order number as `external_reference`
  and the buyer is redirected to `init_point`; Pix, card, boleto and account money are whatever the
  Mercado Pago account offers. Preferences expire after 24 h so Pix/boleto have time to be paid.
- Webhooks are pointers (`type` + `data.id`). The adapter validates `x-signature`
  (HMAC-SHA256 of `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` with `MP_WEBHOOK_SECRET`),
  then fetches the payment: `approved` marks the order paid, `rejected` / `cancelled` mark it
  failed, anything else is ignored. The same payment id is notified several times as it moves from
  pending to approved, so stored event ids are `payment:<id>:<status>`.
- Paid plans use a pending preapproval **without** a Mercado Pago plan, carrying its own
  `auto_recurring` terms, so Mercado Pago hosts the card form at `init_point` (plan-linked
  subscriptions require a card token collected on our side, status `authorized`); `subscription_preapproval` (authorized / paused / cancelled) and
  `subscription_authorized_payment` (renewals) drive the local status. Cancelling sets the
  preapproval to `cancelled`; local entitlement keeps access until the paid period ends.
- Payouts stay manual. Automated split payouts would use Mercado Pago marketplace mode (Phase 2).
- Lost webhooks are not fatal: reading a PENDING order (`GET /orders/:id`) or a pending seller
  subscription asks Mercado Pago for the current state (`GET /v1/payments/search` by order number,
  `GET /preapproval/:id`) and applies it through the same transitions a webhook would. An order with
  no payment attempt after the 24 h checkout window is marked failed ("Checkout expired"). The paid
  transition is a compare-and-set, so a webhook and a reconciliation racing each other cannot credit
  the ledger twice. The buyer's order page re-reads every 15 s while pending.
- Sandbox specifics: Mercado Pago's *test credentials* belong to a second application owned by the
  Seller Test User (its number is shown under "Test credentials data"). Notifications for test
  payments are signed with **that** application's webhook secret, so configure the webhook URL and
  copy the secret from the seller test user's own developer panel, and leave the main application's
  test-mode notifications empty to avoid duplicate deliveries signed with the other key. Buyers must
  be logged in as the Buyer Test User; Pix and boleto stay pending forever; the test card with holder
  name `APRO` approves, `FUND` rejects, `OTHE` may go to review (in process).
- Panel setup: application (Checkout Pro, Preferences API) → test credentials → test accounts
  (one seller, one buyer) → Webhooks (in the seller test user's application for the sandbox, in the
  main application's production mode for go-live), URL `https://<api-host>/api/webhooks/payments`,
  events **Payments** and **Plans and subscriptions**.

Required variables: `MP_ACCESS_TOKEN` (`TEST-…` / `APP_USR-…`), `MP_WEBHOOK_SECRET`, and
`API_URL`. Preferences carry no `notification_url`: the webhook URL is configured in the panel of the
application that owns the access token, always on its **Production** tab (sandbox: the seller test
user's app, whose `APP_USR-` credentials count as production; go-live: the main app), so every delivery is signed with that app's secret and visible in its delivery history.

### Prices, provider fee, refunds and chargebacks

- **Fee-inclusive prices.** Sellers enter their own price (`Product.basePriceCents`). The listed price
  buyers see and pay is `ceil(seller price / (1 - fee))` with the fee from **Admin → Settings →
  Mercado Pago fee** (`finance.gateway_fee_bps`, default 0). Saving a new rate reprices every product
  in the same transaction; orders already placed keep their snapshot. Checkout allows one payment
  only, so the buyer pays exactly the listed price (no installment interest).
- **Split of each sold item:** `priceCents = gatewayFeeCents + commissionCents + vendorNetCents`. The fee
  reserve covers Mercado Pago, the commission is taken from the seller's price, the seller keeps the
  rest. Example with a 5% fee and 20% commission: seller price 25,00 → listed 26,32 → fee 1,32,
  commission 5,00, seller 20,00.
- **Refunds:** Admin → Orders → Refund (paid orders). Mercado Pago refunds the full charge first
  (idempotency key `refund-<payment id>`); only then the order becomes REFUNDED, each seller credit is
  reversed with a `REFUND_DEBIT`, sales counters drop and downloads close. If Mercado Pago refuses,
  nothing changes.
- **Refunds made in Mercado Pago's dashboard and chargebacks** arrive as `refunded` /
  `charged_back` payment notifications and take the same path (reason prefixed "Chargeback:" for
  disputes). Open disputes (`in_mediation`) change nothing until decided. Every path is idempotent.
- A seller whose credit was already withdrawn goes negative: new sales cover it, and withdrawals
  cannot be approved or marked paid while the available balance is below zero.

## Not in the MVP (planned next)

- Background jobs on Redis/BullMQ (ledger release, subscription expiry, webhook replay).
- Multi-currency.
- Server-side rendering of authenticated pages with cookie sessions (currently JWT in the browser).
- Public CDN bucket for thumbnails instead of signed media URLs.
