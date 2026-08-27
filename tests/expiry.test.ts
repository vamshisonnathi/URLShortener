import { describe, it, expect } from 'vitest';
import { isExpired, isServable } from '../src/lib/expiry.js';

const now = new Date('2026-08-26T12:00:00.000Z');
const past = new Date('2026-08-25T12:00:00.000Z');
const future = new Date('2026-08-27T12:00:00.000Z');

describe('isExpired', () => {
  it('is false when expiresAt is null (never expires)', () => {
    expect(isExpired({ expiresAt: null, isActive: true }, now)).toBe(false);
  });
  it('is true when expiresAt is in the past', () => {
    expect(isExpired({ expiresAt: past, isActive: true }, now)).toBe(true);
  });
  it('is false when expiresAt is in the future', () => {
    expect(isExpired({ expiresAt: future, isActive: true }, now)).toBe(false);
  });
  it('treats the exact expiry instant as expired', () => {
    expect(isExpired({ expiresAt: now, isActive: true }, now)).toBe(true);
  });
});

describe('isServable', () => {
  it('serves active, unexpired links', () => {
    expect(isServable({ expiresAt: future, isActive: true }, now)).toBe(true);
    expect(isServable({ expiresAt: null, isActive: true }, now)).toBe(true);
  });
  it('does not serve inactive links', () => {
    expect(isServable({ expiresAt: future, isActive: false }, now)).toBe(false);
  });
  it('does not serve expired links', () => {
    expect(isServable({ expiresAt: past, isActive: true }, now)).toBe(false);
  });
});
