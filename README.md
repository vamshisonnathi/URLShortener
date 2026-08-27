# URL Shortener

Production-grade URL shortener: Node.js + TypeScript + Fastify + PostgreSQL (Prisma)
+ Redis, containerized with Docker Compose.

- 7-char base62 short codes generated with `crypto.randomBytes` + rejection
  sampling (uniform, no modulo bias).
- 302 redirects with **non-blocking, guarded** click analytics.
- Redis read-through cache for code→URL lookups, with **graceful degradation** to
  Postgres when Redis is down.
- Redis **token-bucket** rate limiting per IP on `POST /api/shorten`.
- Indexed SQL aggregation for analytics (no `SELECT *` + in-memory filtering).
- Structured logging (pino) with request IDs; graceful shutdown on SIGTERM.

### Assignment deliverables
- [`SCENARIOS.md`](SCENARIOS.md) — greenfield / brownfield / ambiguous scenarios
  (decomposition → execution → validation).
- [`ENGINEERING_SUMMARY.md`](ENGINEERING_SUMMARY.md) — plan, artifacts, risks,
  validation, assumptions, limitations.
- [`SECURITY.md`](SECURITY.md) — security posture, review, secure-AI usage.
- [`AI_TRACEABILITY.md`](AI_TRACEABILITY.md) — AI generated/edited/rejected ledger.

---

## Command reference (cheat-sheet)

> `docker compose` (Docker Desktop / plugin) and `docker-compose` (standalone v2,
> e.g. with Colima) are interchangeable — use whichever your setup has.

| Goal | Command |
|------|---------|
| Build + run everything | `docker compose up --build` |
| Run in background | `docker compose up --build -d` |
| Tail app logs | `docker compose logs -f app` |
| Container status | `docker compose ps` |
| Stop | `docker compose down` |
| Stop + wipe DB volume | `docker compose down -v` |
| Seed sample data (running stack) | `docker compose exec app npx tsx prisma/seed.ts` |
| Datastores only (host runs the app) | `docker compose up -d postgres redis` |
| Install deps | `npm install` |
| Generate Prisma client | `npm run prisma:generate` |
| Apply migrations (prod) | `npm run prisma:migrate` |
| Apply migrations (dev) | `npm run prisma:migrate:dev` |
| Seed sample data (local) | `npm run db:seed` |
| Dev server (hot reload) | `npm run dev` |
| Build TS → `dist/` | `npm run build` |
| Start built server | `npm start` |
| Typecheck | `npm run lint` |
| All tests | `npm test` |
| Watch tests | `npm run test:watch` |
| Verify 3 scenarios (live) | `./scripts/verify-scenarios.sh` |

The API listens on `http://localhost:3000` in every mode.

---

## Quick start (Docker)

```bash
cp .env.example .env      # optional for compose; compose sets its own env
docker compose up --build
```

This starts Postgres, Redis, and the app. Migrations run automatically on boot
(`prisma migrate deploy` via the entrypoint). The API is then at
`http://localhost:3000`.

Smoke test:

```bash
curl -s -X POST http://localhost:3000/api/shorten \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/some/long/path"}'
```

Then open the returned `shortUrl` in a browser (302 → original), and:

```bash
curl -s http://localhost:3000/api/analytics/<shortCode>
```

## Local development (without Docker for the app)

Run only the datastores in Docker, the app on the host:

```bash
docker compose up -d postgres redis
cp .env.example .env       # DATABASE_URL / REDIS_URL already point at localhost
npm install
npm run prisma:generate
npm run prisma:migrate:dev # or: npm run prisma:migrate (deploy)
npm run dev
```

---

## API reference

### `POST /api/shorten`

Create a short link.

**Body**

| field         | type            | required | notes                                             |
|---------------|-----------------|----------|---------------------------------------------------|
| `url`         | string          | yes      | must be a valid `http(s)` URL                     |
| `customAlias` | string          | no       | `[A-Za-z0-9_-]{3,32}`; `409` if already taken     |
| `expiresAt`   | ISO-8601 string | no       | must be in the future                             |

**201 Response**

```json
{
  "shortCode": "aZ3kR9p",
  "shortUrl": "http://localhost:3000/aZ3kR9p",
  "expiresAt": null
}
```

**Errors:** `400` validation, `409` alias taken, `429` rate limited.

Rate-limit headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
plus `Retry-After` on `429`.

### `GET /:shortCode`

- `302` redirect to the original URL (see trade-off note below).
- `404` unknown code, `410` expired or inactive.
- Records a click asynchronously (never blocks the redirect).

### `GET /api/analytics/:shortCode`

```json
{
  "shortCode": "aZ3kR9p",
  "totalClicks": 2,
  "clicksByDay": [{ "day": "2026-08-26", "clicks": 2 }],
  "topReferrers": [{ "referrer": "https://news.ycombinator.com/", "clicks": 1 }],
  "topCountries": [{ "country": "US", "clicks": 1 }]
}
```

`404` if the code is unknown.

### `GET /health`

Liveness + dependency checks. `200` when the DB is reachable, `503` if not.
Redis being down is reported as `redis: "down"` but does **not** fail health —
the app degrades to Postgres.

```json
{ "status": "ok", "checks": { "db": "up", "redis": "up" }, "uptime": 12.3, "timestamp": "..." }
```

---

## Architecture overview

```
Client
  │
  ▼
Fastify (trustProxy, pino + request IDs)
  ├─ POST /api/shorten ──► rate limiter (Redis token bucket)
  │                        └► shorten service ─► Prisma ─► Postgres (links)
  │
  ├─ GET /:shortCode ────► resolve service
  │                        ├─ Redis read-through cache (code → url/expiry)
  │                        └─ Postgres fallback (+ cache backfill)
  │                        └► 302 + guarded async click write (clicks)
  │
  └─ GET /api/analytics/:code ─► indexed SQL aggregation (Postgres)
```

**Data model** (`prisma/schema.prisma`):

- `links`: `id`, `short_code` (UNIQUE), `original_url`, `custom_alias`,
  `created_at`, `expires_at`, `is_active`. Index on `expires_at`.
- `clicks`: `id`, `link_id` (FK → links, cascade), `clicked_at`, `referrer`,
  `user_agent`, `ip_country`. **Composite index `(link_id, clicked_at)`** powers
  analytics aggregation.

**Key components** (`src/`):

- `lib/base62.ts` — unbiased base62 code generation (rejection sampling).
- `lib/validation.ts` — Zod schemas (URL scheme, alias, future expiry).
- `services/shorten.ts` — insert with unique-conflict retry / alias 409.
- `services/resolve.ts` + `services/cache.ts` — read-through cache + fallback.
- `services/click.ts` — fire-and-forget, guarded click write.
- `services/analytics.ts` — `GROUP BY` aggregation via `$queryRaw`.
- `services/rateLimit.ts` — atomic Lua token bucket in Redis.
- `app.ts` / `server.ts` — Fastify wiring, error handling, graceful shutdown.

---

## Design decisions & trade-offs

- **302 over 301 (deliberate).** A `301` is cached by browsers and repeat visits
  never reach the server, corrupting click analytics. For a *tracked* shortener,
  always-hit-the-server beats the marginal SEO/latency benefit of a permanent
  redirect. `302` keeps every click observable.

- **Unbiased base62.** `crypto.randomBytes` + rejection sampling (bytes ≥ 248 are
  discarded) so each of the 62 symbols is equally likely. A naïve `byte % 62`
  over-represents the first 8 symbols (256 = 4·62 + 8). Uniqueness relies on the
  ~3.5×10¹² key space plus a DB unique constraint with retry-on-conflict.

- **Guarded async click writes.** The click INSERT is *not* awaited before the
  redirect, and is wrapped in `try/catch` with error logging. A slow or failing
  analytics write can never delay or break a redirect. **Upgrade path (deferred):**
  under high write load, replace the direct INSERT with a push to Redis Streams
  drained by a batch worker — see *Deferred* below.

- **Graceful degradation.** If Redis is unreachable, the resolver falls back to
  Postgres and the rate limiter fails open (allows the request) — both log a
  warning rather than returning `500`. Redis is an optimization, not a hard
  dependency for correctness.

- **Rate limiting: token bucket only.** Implemented as a single atomic Lua script
  (refill + consume in one round-trip). Token bucket allows short bursts up to
  capacity while bounding the sustained rate; chosen over sliding-window per spec.

- **`ip_country` from headers, no geoip library.** Read from `CF-IPCountry` /
  `X-Country` (CDN/upstream-provided), default `XX`. A geoip resolver is
  explicitly out of scope.

- **Indexed aggregation.** Analytics uses `GROUP BY` pushed into Postgres, served
  by the `(link_id, clicked_at)` composite index — never `SELECT *` + JS filtering.

---

## Testing approach

```bash
# Unit tests only (no external services needed):
npx vitest run tests/base62.test.ts tests/validation.test.ts tests/expiry.test.ts

# Full suite incl. integration (needs Postgres + Redis on localhost):
docker compose up -d postgres redis
npm run prisma:migrate      # apply schema to the test DB
npm test
```

**Current status:** 26 tests across 4 files, all passing.

### Test inventory

**Unit — no external services needed**

`tests/base62.test.ts` (code generation)
- returns a code of the requested length (default 7)
- emits only base62 alphabet characters (1000 samples)
- throws on non-positive length
- effectively collision-free at scale — 50,000 codes, zero duplicates (uniqueness)
- **no modulo bias** — 62×4000 single-char samples pass a chi-square test
  (χ² < 112 at 61 dof); a naïve-modulo generator fails this

`tests/validation.test.ts` (Zod request validation)
- accepts valid `http`/`https` URLs
- rejects non-http(s) schemes (`ftp:`, `javascript:`, `file:`, `mailto:`)
- rejects malformed URLs (`"not a url"`, `http://`, `example.com`, …)
- rejects a past `expiresAt`; accepts a future one
- rejects a non-ISO `expiresAt`
- validates `customAlias` charset & length (`[A-Za-z0-9_-]{3,32}`)
- rejects reserved aliases (`health`, `api`) that would shadow system routes
  (case-insensitive) — see `SCENARIOS.md` Scenario 2
- rejects unknown body keys (`.strict()`)

`tests/expiry.test.ts` (expiry/servable logic)
- `isExpired`: null expiry never expires; past = expired; future = not; exact
  instant = expired
- `isServable`: active + unexpired serve; inactive or expired do not

**Integration — needs Postgres (+ Redis; degrades if absent)**

`tests/integration.test.ts` — real Fastify app via `inject`, real Postgres:
- **full flow:** `POST /api/shorten` → `201` (7-char code, correct `shortUrl`) →
  `GET /:code` → `302` with exact `location` → analytics reflects **both** clicks
  with correct `topReferrers` and `topCountries` (via `CF-IPCountry`/`referer`
  headers). Polls analytics because the click write is intentionally async.
- **custom alias:** first insert `201`, duplicate reuse → `409 ALIAS_TAKEN`
- **not found / expired:** unknown code → `404`; a link with past `expiresAt` →
  `410`
- **bad input:** `ftp://` URL → `400 VALIDATION_ERROR`
- **health:** `/health` → `200` with `db: up`

Integration tests connect using `DATABASE_URL` (defaults to the compose Postgres
on `localhost:5432`) and clean up the rows they create.

### Run specific tests

```bash
npx vitest run tests/base62.test.ts        # one file
npx vitest run -t "no modulo bias"         # one test by name
npm run test:watch                         # watch mode
```

### Verify the three scenarios (live smoke)

Against a running instance (`docker compose up`), one command checks all three
scenarios from [`SCENARIOS.md`](SCENARIOS.md) and prints PASS/FAIL per assertion
(exit non-zero on any failure — CI-friendly):

```bash
./scripts/verify-scenarios.sh                        # targets http://localhost:3000
BASE_URL=http://host:port ./scripts/verify-scenarios.sh
```

Covers: greenfield `shorten → 302 → analytics`; brownfield reserved-alias guard
(`health`/`api` → 400, `/health` route still 200, normal alias 201); ambiguous
no-dedup (same URL → distinct codes).

---

## Configuration

All config is environment-driven and validated at startup (`src/config.ts`).
See `.env.example`. No secrets are committed.

| var | default | purpose |
|-----|---------|---------|
| `PORT` / `HOST` | `3000` / `0.0.0.0` | listen address |
| `SHORT_URL_BASE` | `http://localhost:3000` | base for `shortUrl` in responses |
| `DATABASE_URL` | — | Postgres connection string |
| `REDIS_URL` | — | Redis connection string |
| `CACHE_TTL_SECONDS` | `3600` | read-through cache TTL |
| `RATE_LIMIT_CAPACITY` | `20` | token bucket capacity per IP |
| `RATE_LIMIT_REFILL_PER_SEC` | `1` | token refill rate per IP |

---

## Limitations & deferred (explicitly out of scope)

- **Redis Streams / batch analytics worker** — the documented upgrade path from
  guarded async writes under high write load. Not built.
- **GeoIP resolution library** — country comes from a request header only.
- **Sliding-window rate limiting** — token bucket only, by design.
- No auth / ownership model, no link editing/deletion API, no UI — the spec
  scopes this to the listed APIs only.
