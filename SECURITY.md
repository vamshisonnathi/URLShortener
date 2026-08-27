# Security & Quality Gates

Security posture, the review performed, and secure-AI-usage notes for this build.

## Threat-model summary

A public, unauthenticated redirector that stores user-supplied URLs and serves
redirects + analytics. Primary concerns: input abuse, injection, open-redirect
misuse, resource exhaustion, and secret handling.

## Controls in place

| Concern | Control | Where |
|---------|---------|-------|
| Malicious / malformed input | zod **strict** schema; `http(s)`-only URL scheme; bounded alias charset/length; future-only expiry | `src/lib/validation.ts` |
| SQL injection | Prisma parameterized queries; raw analytics uses `Prisma.sql` tagged templates (no string concatenation) | `src/services/analytics.ts` |
| Route shadowing via alias | Reserved-alias blocklist (`health`, `api`), case-insensitive → `400` | `src/lib/validation.ts` (Scenario 2) |
| Resource exhaustion / abuse | Redis token-bucket rate limit per IP on `POST /api/shorten` | `src/services/rateLimit.ts` |
| Serving stale/dead links | `404`/`410`; expiry bounds cache TTL; `is_active` flag | `src/routes/redirect.ts`, `src/services/cache.ts` |
| Secret leakage | No secrets in code; all config via env, zod-validated at startup; `.env` git-ignored; only `.env.example` committed | `src/config.ts`, `.gitignore` |
| Info disclosure on errors | Central error handler returns generic `INTERNAL_ERROR`; details go to logs only | `src/app.ts` |
| Log hygiene | Structured pino logs; no URLs-with-credentials constructed; request IDs for tracing | `src/logger.ts`, `src/app.ts` |
| DoS via unbounded body | Fastify default body limit (1 MB) retained; single-object payloads | Fastify defaults |

## Known accepted trade-offs

- **Open-redirect by design.** A URL shortener *is* an open redirector; we
  constrain to `http(s)` and do not fetch or preview targets. Destination
  reputation/blocklisting is out of scope for this prototype (noted as future
  work).
- **Rate limiter fails open** when Redis is down (availability chosen over strict
  limiting) — logged as a warning so the gap is observable.
- **No auth** — the prototype is unauthenticated by requirement.

## Security review performed

- Manual review of every route and service for the concerns above.
- Verified parameterization of the only raw-SQL path (`analytics.ts`) — values
  are bound via `Prisma.sql`, not interpolated.
- Verified no secrets are committed (`git`-ignored `.env`; `.env.example` holds
  placeholders only).
- Reproduced and fixed one real correctness/abuse bug (reserved-alias shadowing)
  with a regression test — see [`SCENARIOS.md`](SCENARIOS.md) Scenario 2.
- **Result:** no high/critical items open. Future hardening tracked below.

### Suggested follow-ups (not blocking)
- Destination blocklist / safe-browsing check for abusive targets.
- Per-alias and global (not just per-IP) rate ceilings.
- Optional auth + per-owner link management.
- Automated dependency scanning (`npm audit` / SCA) in CI.

## Secure AI usage (assignment §4)

- AI was used within engineer-defined tasks; **no secrets, credentials, or
  private data were shared** with the AI — config uses placeholder env values
  only.
- Every AI-generated artifact was reviewed before acceptance; the raw-SQL path
  and input-validation code received extra scrutiny (the highest-risk surfaces).
- High-impact or non-obvious outputs were edited or rejected with rationale
  recorded in [`AI_TRACEABILITY.md`](AI_TRACEABILITY.md) — the engineer signs off
  on correctness.

## Quality gates (commands)

```bash
npm run lint     # tsc --noEmit (strict types)
npm test         # 25 unit + integration tests
npm audit        # dependency vulnerability scan (run in CI)
```
