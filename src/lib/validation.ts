import { z } from 'zod';

// Only http/https URLs are acceptable targets for a public redirector.
function isHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

// Alias must be URL-path-safe and distinguishable from generated codes.
// Allow unreserved chars; length bounded to keep short links short.
const ALIAS_RE = /^[A-Za-z0-9_-]{3,32}$/;

// Reserved top-level path segments. A custom alias equal to one of these would
// be shadowed by a more specific route (`/:shortCode` is registered last), so
// the link would 201 but never resolve. Reject them up front. Keep in sync with
// the top-level routes registered in src/app.ts.
export const RESERVED_ALIASES = new Set(['health', 'api']);

function isReservedAlias(alias: string): boolean {
  return RESERVED_ALIASES.has(alias.toLowerCase());
}

export const ShortenBodySchema = z
  .object({
    url: z
      .string({ required_error: 'url is required' })
      .trim()
      .min(1, 'url is required')
      .refine(isHttpUrl, 'url must be a valid http(s) URL'),
    customAlias: z
      .string()
      .trim()
      .regex(ALIAS_RE, 'customAlias must be 3-32 chars of [A-Za-z0-9_-]')
      .refine((a) => !isReservedAlias(a), 'customAlias is reserved and cannot be used')
      .optional(),
    expiresAt: z
      .string()
      .datetime({ offset: true, message: 'expiresAt must be an ISO-8601 datetime' })
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.expiresAt) {
      const when = new Date(data.expiresAt);
      if (when.getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiresAt'],
          message: 'expiresAt must be in the future',
        });
      }
    }
  });

export type ShortenBody = z.infer<typeof ShortenBodySchema>;

// Path param: either a generated 7-char base62 code or a custom alias.
export const ShortCodeParamSchema = z.object({
  shortCode: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/, 'invalid short code'),
});
