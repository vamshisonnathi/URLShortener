/**
 * @file Zod Input Validation Unit Test Suite
 * @description Unit tests for URL scheme validation, custom alias constraints, reserved route protection, and expiry timestamps.
 */

import { describe, it, expect } from 'vitest';
import { ShortenBodySchema } from '../src/lib/validation.js';

function future(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
function past(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

describe('ShortenBodySchema', () => {
  it('accepts a valid http(s) url', () => {
    expect(ShortenBodySchema.safeParse({ url: 'https://example.com/path?q=1' }).success).toBe(true);
    expect(ShortenBodySchema.safeParse({ url: 'http://example.com' }).success).toBe(true);
  });

  it('rejects non-http(s) schemes', () => {
    for (const url of ['ftp://example.com', 'javascript:alert(1)', 'file:///etc/passwd', 'mailto:a@b.c']) {
      expect(ShortenBodySchema.safeParse({ url }).success).toBe(false);
    }
  });

  it('rejects malformed urls', () => {
    for (const url of ['not a url', 'http://', 'example.com', '://nope', '']) {
      expect(ShortenBodySchema.safeParse({ url }).success).toBe(false);
    }
  });

  it('rejects a past expiry date', () => {
    const res = ShortenBodySchema.safeParse({ url: 'https://example.com', expiresAt: past(1) });
    expect(res.success).toBe(false);
  });

  it('accepts a future expiry date', () => {
    const res = ShortenBodySchema.safeParse({ url: 'https://example.com', expiresAt: future(1) });
    expect(res.success).toBe(true);
  });

  it('rejects a non-ISO expiry date', () => {
    const res = ShortenBodySchema.safeParse({ url: 'https://example.com', expiresAt: '2026-13-40' });
    expect(res.success).toBe(false);
  });

  it('validates customAlias charset and length', () => {
    expect(ShortenBodySchema.safeParse({ url: 'https://x.com', customAlias: 'my-Alias_1' }).success).toBe(true);
    expect(ShortenBodySchema.safeParse({ url: 'https://x.com', customAlias: 'ab' }).success).toBe(false); // too short
    expect(ShortenBodySchema.safeParse({ url: 'https://x.com', customAlias: 'has space' }).success).toBe(false);
    expect(ShortenBodySchema.safeParse({ url: 'https://x.com', customAlias: 'bad/slash' }).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    const res = ShortenBodySchema.safeParse({ url: 'https://x.com', foo: 'bar' });
    expect(res.success).toBe(false);
  });

  it('rejects reserved aliases that would shadow system routes (case-insensitive)', () => {
    // Regression: alias 'health' previously 201'd but the link never resolved
    // because GET /health hits the health route, not /:shortCode.
    for (const alias of ['health', 'api', 'Health', 'API']) {
      expect(ShortenBodySchema.safeParse({ url: 'https://x.com', customAlias: alias }).success).toBe(false);
    }
  });
});
