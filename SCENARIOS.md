# Engineering Scenarios

Three worked scenarios demonstrating AI-assisted, engineer-led execution. Each
follows the same loop: **Intent → Decomposition → Execution → Validation**, with
explicit engineering judgment and AI accept/edit/reject decisions. See
[`AI_TRACEABILITY.md`](AI_TRACEABILITY.md) for the per-output ledger.

---

## Scenario 1 — Greenfield: build the URL shortener from scratch

### Intent / requirement
Transform a written spec (core APIs, analytics, reliability features) into a
runnable, production-grade service. Well-defined requirement.

### Ambiguity normalization
The spec was detailed but left a few things implicit; resolved before coding:
- **Short-code length/space** — fixed at 7 base62 chars (~3.5×10¹² space) — large
  enough that collisions are astronomically rare yet handled by a DB unique
  constraint + retry.
- **`shortUrl` host** — not hard-coded; driven by `SHORT_URL_BASE` so the same
  build works in Docker, local, and prod.
- **HTTP status on create** — `201 Created` (a resource is created), not `200`.

### Decomposition (tasks + sequencing + dependencies)
1. Project scaffold: TS strict, Fastify, Prisma, Redis, Vitest, Docker. *(no deps)*
2. Data model + migration (`links`, `clicks`, indexes). *(→ 1)*
3. Pure libs: `base62` (unbiased), `validation` (zod), `expiry`. *(→ 1)*
4. Infra clients: `config` (zod-parsed env), `logger` (pino), `db`, `redis`. *(→ 1)*
5. Services: `shorten`, `resolve`+`cache`, `click`, `analytics`, `rateLimit`. *(→ 2,3,4)*
6. Routes: `shorten`, `redirect`, `analytics`, `health`. *(→ 5)*
7. App wiring + graceful shutdown. *(→ 6)*
8. Tests (unit + integration). *(→ 3,7)*
9. Docker, entrypoint (auto-migrate), README, traceability. *(→ 7,8)*

### Execution (key engineering decisions)
- **Unbiased base62** via `crypto.randomBytes` + rejection sampling (reject bytes
  ≥ 248) — not `Math.random`, not `byte % 62` (which over-weights the first 8
  symbols). *AI proposed the approach; accepted.*
- **302 over 301** — deliberate: a 301 is client-cached and bypasses the server,
  corrupting click analytics.
- **Guarded async click write** — the click INSERT is not awaited and is wrapped
  in try/catch; a slow/failed analytics write never blocks or breaks a redirect.
- **Graceful degradation** — Redis outage falls back to Postgres (resolver) and
  fails open (rate limiter), logging a warning instead of returning 500.
- **Token-bucket rate limit** as a single atomic Lua script (refill + consume in
  one round-trip).

### Validation
- 25 automated tests (unit + integration), all passing.
- Live smoke test through Docker: `shorten → 302 → analytics`, plus `400/404/410/
  409/429`, `/health`, and a Redis-down degradation run (still `200`, no `500`).
- Quality gates: `tsc --noEmit` clean, `vitest` green — see
  [`ENGINEERING_SUMMARY.md`](ENGINEERING_SUMMARY.md) §Quality gates.

**Artifacts:** the whole `src/`, `prisma/`, `tests/`, `docker-compose.yml`,
`Dockerfile`, `README.md`.

---

## Scenario 2 — Brownfield: fix a reserved-alias route-shadowing bug

A real defect found while reviewing the greenfield output — enhancement executed
against the existing codebase, demonstrating codebase reasoning.

### Intent / problem
Custom aliases are user-supplied and validated only for charset/length. But the
redirect route `GET /:shortCode` is a catch-all registered *after* the specific
routes. So an alias that equals a top-level route segment (`health`, `api`) is
**shadowed**: the API returns `201 Created`, but every visit to the short link
hits the system route instead of redirecting — a silent, data-dependent failure.

### Codebase reasoning — impact analysis
Traced the request path to find every module involved:
- `src/app.ts` — route registration order (`/health`, `/api/*` are specific;
  `/:shortCode` is the catch-all, registered last). **Root cause lives here** —
  the alias space overlaps the route namespace.
- `src/lib/validation.ts` — where aliases are accepted; the correct place to
  reject the overlap (fail fast, before any DB write).
- `src/services/shorten.ts` — would persist the bad alias (no change needed once
  validation rejects it).
- `src/routes/redirect.ts` — where the shadowing manifests (no change needed).

**Decision:** fix at the validation boundary (reject reserved aliases) rather than
by reordering routes — reordering would make a link alias like `health`
*override* the health check, which is worse. A blocklist keeps system routes
authoritative and gives the user a clear `400` instead of a broken link.

### Reproduction (before)
```bash
# 201 Created — but the link is dead on arrival:
curl -X POST localhost:3000/api/shorten -d '{"url":"https://x.com","customAlias":"health"}'
#  -> {"shortCode":"health", ...}
curl -i localhost:3000/health
#  -> HTTP/1.1 200 OK  (health JSON, NOT a 302 redirect)
```

### Execution (the change)
- `src/lib/validation.ts`: added `RESERVED_ALIASES = {health, api}` and a
  case-insensitive `.refine(...)` on `customAlias` → `400 VALIDATION_ERROR`
  ("customAlias is reserved and cannot be used"). Kept the set adjacent to a
  comment pointing at `app.ts` so the two stay in sync.
- `tests/validation.test.ts`: regression test asserting `health`, `api`,
  `Health`, `API` are all rejected.

*Scope discipline:* fixed only the overlap. Did **not** also add negative caching,
alias profanity filters, or route auto-discovery — out of scope for the bug.

### Validation (after)
```
health-alias  = 400   (was 201)      # bug fixed
api-alias     = 400   "reserved..."  # message is clear
health-route  = 200                  # system route unaffected
normal-alias  = 201                  # regression-safe
```
- `tsc --noEmit` clean; validation suite 9/9; full suite green.
- Verified live in the running Docker stack after `docker compose up --build app`.

**Artifacts:** diff to `src/lib/validation.ts`, `tests/validation.test.ts`;
ledger rows in `AI_TRACEABILITY.md`.

---

## Scenario 3 — Ambiguous: "handle duplicate URLs sensibly"

A deliberately under-specified request. The engineering value is in surfacing the
ambiguity, enumerating options with trade-offs, and making a defensible call —
not in guessing.

### The ambiguous requirement
> "When someone shortens a URL we've already seen, handle it sensibly."

"Sensibly" is undefined. It hides a real product/architecture fork.

### Ambiguity surfaced — the actual question
Should shortening an identical `original_url` **deduplicate** (return the existing
short code) or **always mint a new code**? The requester didn't say, and the two
answers imply different data models and different analytics semantics.

### Options + trade-offs
| Option | Pros | Cons |
|--------|------|------|
| **A. Always new code** (current behavior) | Per-link analytics isolation (two campaigns → two codes → separate click stats); custom alias & expiry are unambiguous; simplest write path | Same destination can have many codes; marginally more rows |
| **B. Deduplicate** (one code per URL) | Fewer rows; one canonical link per destination | **Breaks campaign tracking** — two teams sharing a URL can't get separate analytics; ambiguous when alias/expiry differ per request ("which wins?"); needs an index on `original_url` and a lookup on every create |
| **C. Dedupe only when no alias/expiry given** | Middle ground | Most complex; surprising ("sometimes I get a new code, sometimes not") |

### Decision + rationale (engineer-owned)
**Chose A — always mint a new code** (which is what the code already does, now
made explicit and documented rather than accidental):
- **Analytics isolation is a core feature** of this service. Dedup would silently
  merge the click streams of two unrelated shorten requests — a correctness
  problem for the product's headline capability.
- Dedup collides with `customAlias` and `expiresAt`: if request 1 set a 7-day
  expiry and request 2 sets none, option B has no non-surprising answer.
- Storage cost of extra rows is negligible next to the click volume; not a real
  constraint.

**If the requester actually wanted dedup**, the right shape is *opt-in*, not
default: a `dedupe: true` flag on `POST /api/shorten` that returns an existing
code only when alias/expiry are absent. Recorded as a future option, not built —
no speculative implementation.

### Validation of the decision
- Confirmed current behavior matches the decision: two shortens of the same URL
  return **different** codes.
```bash
curl -sX POST localhost:3000/api/shorten -d '{"url":"https://dup.example.com"}'   # -> code A
curl -sX POST localhost:3000/api/shorten -d '{"url":"https://dup.example.com"}'   # -> code B (A != B)
```
- No code change required; the outcome is a **documented, defensible decision** +
  a scoped future path — which is the correct output for an ambiguous requirement.

**Artifacts:** this section; the recorded future `dedupe` flag design in
[`ENGINEERING_SUMMARY.md`](ENGINEERING_SUMMARY.md) §Limitations & future work.
