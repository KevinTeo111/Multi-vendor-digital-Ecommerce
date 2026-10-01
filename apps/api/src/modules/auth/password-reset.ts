import { createHash } from 'node:crypto';
import { env } from '../../config/env';

/**
 * Password reset tokens are signed JWTs, not database rows. Each token carries a fingerprint of
 * the password hash it was issued for; once the password changes the fingerprint no longer
 * matches, so a link works exactly once and every older link dies with it. No table, no cleanup.
 */

export const RESET_TOKEN_TTL_SECONDS = 30 * 60;

/** Separate key so a reset token can never be accepted as an access or refresh token. */
export const resetTokenSecret = () => `${env.JWT_REFRESH_SECRET}:password-reset`;

export interface ResetTokenPayload {
  sub: string;
  type: 'password_reset';
  /** First 16 hex chars of sha256(passwordHash) at issue time. */
  pwf: string;
}

export function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}
