// Centralized expiry/active logic so routes and tests agree on one definition.

export interface ExpirableLink {
  expiresAt: Date | null;
  isActive: boolean;
}

export function isExpired(link: ExpirableLink, now: Date = new Date()): boolean {
  return link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime();
}

/** A link is usable for redirect only if active and not past expiry. */
export function isServable(link: ExpirableLink, now: Date = new Date()): boolean {
  return link.isActive && !isExpired(link, now);
}
