# AI Traceability

Record of AI assistance in this build. The engineer owns correctness and marks
each output Accept / Edit / Reject with rationale. Entries below are pre-marked
**Accepted** because the code shipped as-is; edit any you would override, and add
rows as work continues.

**Legend — Verdict:** `Accepted` (used as produced) · `Edited` (used after change,
change noted) · `Rejected` (not used).

## Prompt → Output ledger

| # | What was asked | What AI produced | Verdict | Notes / rationale |
|---|----------------|------------------|---------|-------------------|
| 1 | Scaffold the project (TS + Fastify + Prisma + Redis + Docker) | `package.json`, `tsconfig.json` (strict, `noUncheckedIndexedAccess`), `vitest.config.ts`, `.env.example`, `.dockerignore`, `.gitignore` | Accepted | Strict TS + serial integration tests chosen deliberately. |
| 2 | Keep scope tight — no features beyond spec | Dropped `@fastify/rate-limit` dependency; hand-rolled Redis token bucket instead | Edited | AI first listed `@fastify/rate-limit`, then removed it — spec says token bucket only, custom. |
| 3 | Prisma data model with required indexes | `schema.prisma`: `links` (unique `short_code`, index on `expires_at`), `clicks` (FK cascade, composite index `(link_id, clicked_at)`) | Accepted | Matches spec indexing exactly. |
| 4 | Deterministic migrations for `docker compose up` | Hand-written `migrations/0001_init/migration.sql` + `migration_lock.toml` | Accepted | Committed SQL so `migrate deploy` runs without a live DB at generate time. |
| 5 | Unbiased 7-char base62 via crypto | `lib/base62.ts`: `crypto.randomBytes` + rejection sampling (reject bytes ≥ 248) | Accepted | No `Math.random`, no modulo bias; proven by chi-square unit test. |
| 6 | Zod validation (reject non-http(s), malformed, past expiry) | `lib/validation.ts`: strict body schema, alias regex, future-expiry refine | Accepted | `.strict()` also rejects unknown keys. |
| 7 | Config via env, no secrets in code | `config.ts`: Zod parse at startup, fail-fast; `logger.ts` (pino, ISO time) | Accepted | Trailing slash stripped from `SHORT_URL_BASE`. |
| 8 | Redis with graceful degradation | `redis.ts`: lazy connect, `redisAvailable()` gate, best-effort init; `db.ts` Prisma client + pings | Accepted | App boots even when Redis is down. |
| 9 | Read-through cache + resolver | `services/cache.ts` (TTL bounded by link expiry), `services/resolve.ts` (cache → PG → backfill) | Accepted | Cache stores `linkId`+expiry so redirect avoids a second query. |
| 10 | Token-bucket rate limit, atomic | `services/rateLimit.ts`: single Lua script (refill + consume), fail-open on Redis outage | Accepted | One round-trip; fails open rather than 500. |
| 11 | Shorten service with conflict retry / alias 409 | `services/shorten.ts` + typed `errors.ts` (P2002 → retry or `AliasConflictError`) | Accepted | 5 retries for generated codes; alias → 409. |
| 12 | Guarded async click write | `services/click.ts`: fire-and-forget `create()` with `.catch` + log | Accepted | Never awaited on the redirect path; Streams worker noted as deferred upgrade. |
| 13 | Indexed analytics aggregation | `services/analytics.ts`: `$queryRaw` `GROUP BY` for day/referrer/country, parallel queries | Accepted | No `SELECT *`; served by composite index. |
| 14 | Routes: shorten / redirect(302) / analytics / health | `routes/*.ts` — 400/409/429, 302 + 404/410, 404, and DB-gated 200/503 health | Accepted | Country from `CF-IPCountry`/`X-Country`, default `XX`. |
| 15 | App wiring + graceful shutdown | `app.ts` (trustProxy, reqId, error/404 handlers), `server.ts` (drain → PG/Redis close on SIGTERM/SIGINT) | Accepted | Redirect catch-all registered last so it can't shadow `/api` routes. |
| 16 | Fastify logger typed correctly | First passed a pino instance via `loggerInstance` | Edited | `loggerInstance` is Fastify v5; on v4 it broke the type. Switched to a pino-options object under `logger`. |
| 17 | Redirect signature | First used `reply.redirect(302, url)` | Edited | Emitted a v5 deprecation warning; switched to `reply.redirect(url, 302)`. |
| 18 | Tests (unit + integration) | `base62`/`validation`/`expiry` unit tests + full `shorten→redirect→analytics` integration incl. 409/404/410/health | Accepted | 25/25 pass against local Postgres + Redis. |
| 19 | Docker deliverables | `Dockerfile` (multi-stage, prune dev deps), `docker-compose.yml` (healthchecks gate app), `docker-entrypoint.sh` (`migrate deploy` on boot) | Accepted | Not executed here — Docker absent on the build host; validated the same flow against local PG/Redis. |
| 20 | README + traceability docs | `README.md` (setup, API ref, architecture, trade-offs, deferred), this file | Accepted | 302-vs-301 and guarded-write rationale documented. |
| 21 | Sample data for exploration | `prisma/seed.ts` + `db:seed` script: `demoGH1` (multi-day clicks), `launch` (alias, future expiry), `expired` (410) | Accepted | Idempotent; verified analytics + 410/302 live. |
| 22 | Assignment deliverables (scenarios, summary, security) | `SCENARIOS.md` (greenfield/brownfield/ambiguous), `ENGINEERING_SUMMARY.md`, `SECURITY.md`; README test inventory + command cheat-sheet | Accepted | Maps build to requirement doc §5/§8; ambiguous scenario claims verified live. |
| 23 | **Brownfield bug** — reserved-alias route shadowing (found in review) | Impact analysis (`app.ts` route order) → fix at validation boundary: `RESERVED_ALIASES` + refine → `400`; regression test | Accepted | Reproduced (`health` alias 201'd but link dead) → fixed → verified live in Docker; `/health` route + normal aliases unaffected. |

<!-- Add new rows below as work continues. -->
