/**
 * @file Link Expiry & Servability Logic
 * @description Centralized business logic for evaluating whether short links are active and unexpired.
 * @module lib/expiry
 */

/**
 * Interface representing a link's expiration timestamp and active flag.
 */
export interface ExpirableLink {
  /** Optional expiration timestamp (null if the link never expires). */
  expiresAt: Date | null;
  /** Active status flag for manual disabling or soft deletion. */
  isActive: boolean;
}

/**
 * Evaluates whether a link's expiration timestamp has passed relative to a reference time.
 *
 * @param link - The expirable link containing `expiresAt`.
 * @param now - Reference timestamp for comparison (defaults to current time).
 * @returns `true` if `expiresAt` is non-null and less than or equal to `now`, otherwise `false`.
 */
export function isExpired(link: ExpirableLink, now: Date = new Date()): boolean {
  return link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime();
}

/**
 * Determines whether a link is servable for HTTP 302 redirects.
 *
 * A link is servable if and only if it is marked active (`isActive === true`)
 * and has not passed its expiration date.
 *
 * @param link - The expirable link to check.
 * @param now - Reference timestamp for comparison (defaults to current time).
 * @returns `true` if active and unexpired, otherwise `false`.
 */
export function isServable(link: ExpirableLink, now: Date = new Date()): boolean {
  return link.isActive && !isExpired(link, now);
}
