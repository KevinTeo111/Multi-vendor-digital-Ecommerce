import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

/**
 * Outbound e-mail behind one interface, like the payment gateway, so a real provider can be
 * plugged in later without touching the features that send mail.
 */
export const MAILER = Symbol('MAILER');

export interface MailRecipient {
  email: string;
  name: string;
}

export interface Mailer {
  /** True when messages actually leave the system (false for the log-only fallback). */
  readonly delivers: boolean;
  sendPasswordReset(to: MailRecipient, resetUrl: string, expiresAt: Date): Promise<void>;
}

/**
 * Fallback used until an e-mail provider is configured. It never sends anything. Outside
 * production it logs the link so developers can test the flow; in production it logs only that
 * a reset was requested, because a live link in the logs would let anyone with log access take
 * over the account. Admins can generate a link from the users screen instead.
 */
@Injectable()
export class LogMailer implements Mailer {
  readonly delivers = false;
  private readonly logger = new Logger('Mailer');

  async sendPasswordReset(to: MailRecipient, resetUrl: string, expiresAt: Date) {
    if (env.NODE_ENV === 'production') {
      this.logger.warn(
        `Password reset requested for ${to.email}, but no e-mail provider is configured. ` +
          `An admin can generate a reset link from Admin → Users.`,
      );
      return;
    }
    this.logger.log(
      `Password reset link for ${to.email} (valid until ${expiresAt.toISOString()}): ${resetUrl}`,
    );
  }
}
