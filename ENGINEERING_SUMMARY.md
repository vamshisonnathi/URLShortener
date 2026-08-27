# Final Engineering Summary

Production-grade URL shortener, built engineer-led with AI as an in-task
accelerator. This document consolidates the plan, artifacts, risks, validation,
assumptions, and limitations. Detailed scenarios are in
[`SCENARIOS.md`](SCENARIOS.md); the AI accept/edit/reject ledger is in
[`AI_TRACEABILITY.md`](AI_TRACEABILITY.md).

---

## 1. Plan & rationale

**Goal:** a runnable, reliable, observable URL shortener with tracked redirects
and analytics, containerized for one-command startup.

**Stack & why:**
- **Fastify** — fast, first-class pino logging, schema-friendly, low overhead on
  the hot redirect path.
- **PostgreSQL + Prisma** — relational fit (links ↔ clicks), typed access, and
  first-class migrations for reproducible schema.
- **Redis** — read-through cache for `code → url` and an atomic token-bucket rate
  limiter; treated as an *optimization*, never a correctness dependency.
- **TypeScript strict** — `noUncheckedIndexedAccess` etc., to catch defects at
  compile time.

**Execution approach:** decompose → build pure/testable units first (base62,
validation, expiry) → infra clients → services → routes → wiring → tests → Docker
& docs. AI drafted each unit against explicit intent + acceptance criteria; the
engineer reviewed, edited (3 corrections logged), and accepted each output.

**Control flow (runtime):**
```
POST /api/shorten → rate limiter (Redis token bucket, fail-open)
                  → zod validation (scheme, alias, reserved, future expiry)
                  → shorten service (unbiased base62 + unique-retry / alias 409)
                  → Postgres insert → 201 {shortCode, shortUrl, expiresAt}

GET /:shortCode   → resolve (Redis read-through → Postgres fallback → backfill)
                  → servable? (active & not expired) else 404/410
                  → 302 redirect  +  guarded async click write (never awaited)

GET /api/analytics/:code → indexed GROUP BY aggregation (day/referrer/country)

GET /health       → DB + Redis pings; 200 if DB up (Redis down = degraded, not dead)
```

---

## 2. Architecture overview

- **Components:** Fastify app (routes → services → Prisma/Redis), PostgreSQL,
  Redis; all orchestrated by Docker Compose with health-gated startup and
  auto-applied migrations on boot.
- **Data model:** `links(id, short_code UNIQUE, original_url, custom_alias,
  created_at, expires_at, is_active)` with an index on `expires_at`;
  `clicks(id, link_id FK, clicked_at, referrer, user_agent, ip_country)` with a
  **composite index `(link_id, clicked_at)`** powering analytics.
- **Key modules:** `lib/base62`, `lib/validation`, `lib/expiry`;
  `services/{shorten,resolve,cache,click,analytics,rateLimit,errors}`;
  `routes/{shorten,redirect,analytics,health}`; `app.ts`, `server.ts`.
- Full component diagram and module list: [`README.md`](README.md) §Architecture.

---

## 3. Artifacts produced

| Artifact | Location |
|----------|----------|
| Runnable prototype (Docker) | `docker-compose.yml`, `Dockerfile`, `docker-entrypoint.sh` |
| Source | `src/**` |
| Schema + migration | `prisma/schema.prisma`, `prisma/migrations/**` |
| Tests (25) | `tests/**` |
| Sample data | `prisma/seed.ts` (`npm run db:seed`) |
| API ref / setup / commands / testing | `README.md` |
| Three scenarios | `SCENARIOS.md` |
| AI traceability ledger | `AI_TRACEABILITY.md` |
| Security & quality gates | `SECURITY.md` |
| This summary | `ENGINEERING_SUMMARY.md` |

---

## 4. Quality gates (evidence)

| Gate | Tool | Result |
|------|------|--------|
| Static analysis / types | `tsc --noEmit` (strict) | Clean |
| Unit tests | Vitest | 21 passing (base62, validation, expiry) |
| Integration tests | Vitest + real Postgres | 5 passing (full flow, 409/404/410/400, health) |
| No-bias proof | chi-square on base62 | χ² well under threshold |
| Runtime smoke | curl vs. Docker stack | shorten/redirect/analytics/health verified |
| Degradation | Redis killed | `200`/`201`/`302` — no `500` |
| Build/release | multi-stage Docker | image builds; migrations auto-apply on boot |
| Security review | see `SECURITY.md` | no high/critical open items |

**Performance notes:** the redirect hot path is O(1) — a single Redis GET on cache
hit, one indexed Postgres lookup on miss, and the click write is off the response
path (fire-and-forget). Analytics is pushed into Postgres via `GROUP BY` on the
`(link_id, clicked_at)` index (no `SELECT *`/in-memory scans). Rate limiting is a
single atomic Lua round-trip. *Not load-tested* — see limitations.

---

## 5. Risks, trade-offs & failure scenarios

| Risk / failure | Handling / mitigation | Residual |
|----------------|-----------------------|----------|
| Redis unreachable | Resolver falls back to Postgres; rate limiter fails open; logged | No rate limiting during outage (availability > strict limiting, by choice) |
| Click write fails/slow | Guarded, non-blocking; error logged | Individual clicks can be lost under DB stress → **upgrade path: Redis Streams + batch worker** |
| Short-code collision | DB unique constraint + retry (≤5) | Negligible at 62⁷ space |
| Alias shadows a route | Reserved-alias blocklist (`SECURITY.md`, Scenario 2) | Blocklist must track new top-level routes |
| Past/inactive links served | `410 Gone`; expiry also bounds cache TTL | — |
| Bad/hostile input | zod strict validation; http(s)-only; no geoip lib | — |
| 301 caching corrupts analytics | Deliberate **302** | Slightly higher server load (accepted) |

---

## 6. Assumptions

- `ip_country` is provided by an upstream/CDN header (`CF-IPCountry`/`X-Country`);
  no geoip resolver (explicitly out of scope). Default `XX`.
- Running behind a trusted proxy/LB (`trustProxy` on) so `request.ip` and
  `X-Forwarded-For` are meaningful for rate limiting.
- Single-region, single Postgres primary; Redis single node.
- No authentication/ownership model is required for this prototype.

---

## 7. Limitations & future work (deferred, not built)

- **Redis Streams / batch analytics worker** — the documented upgrade from
  guarded per-request click writes under high write load.
- **GeoIP resolution** — country comes only from a header today.
- **Sliding-window rate limiting** — token bucket only, by design.
- **Opt-in URL dedup** — a `dedupe: true` flag (return existing code when no
  alias/expiry) — see Scenario 3; default stays "always new code" for analytics
  isolation.
- **AuthN/AuthZ, link management (edit/delete/list), UI** — out of scope.
- **Load/performance testing** — hot paths are designed to be O(1)/indexed but
  not yet benchmarked under load.

---

## 8. Ownership statement

AI accelerated implementation, tests, and documentation within tasks defined by
intent + constraints + acceptance criteria. Every output was engineer-reviewed;
corrections and rejections are logged in `AI_TRACEABILITY.md`. The engineer
retains ownership of correctness, maintainability, and production readiness.
