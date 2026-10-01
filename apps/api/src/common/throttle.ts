/**
 * Request limits per client IP (Render forwards the real IP; main.ts trusts one proxy hop).
 * Only writes are limited (see WriteThrottlerGuard). The default applies to every write route;
 * sensitive auth routes use the stricter presets.
 */
const MINUTE = 60_000;

export const DEFAULT_RATE_LIMIT = { name: 'default', ttl: MINUTE, limit: 120 };

/** Login and registration: enough for typos, too few for password guessing. */
export const LOGIN_RATE_LIMIT = { default: { limit: 10, ttl: MINUTE } };

/** Password reset and change: each request is either an e-mail or a bcrypt hash. */
export const PASSWORD_RATE_LIMIT = { default: { limit: 5, ttl: MINUTE } };

/** Shown to the user instead of the library default ("ThrottlerException: Too Many Requests"). */
export const TOO_MANY_REQUESTS_MESSAGE = 'Too many attempts. Please wait a minute and try again.';
