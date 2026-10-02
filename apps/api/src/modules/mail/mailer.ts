import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

/**
 * Outbound e-mail behind one interface, like the payment gateway, so the provider can be
 * swapped without touching the features that send mail.
 */
export const MAILER = Symbol('MAILER');

export interface MailRecipient {
  email: string;
  name: string;
}

export interface MailMessage {
  to: MailRecipient;
  subject: string;
  html: string;
  text: string;
  /** Kind of message ("order-paid", "password-reset", …): shown in logs and provider statistics. */
  tag: string;
}

export interface Mailer {
  /** True when messages actually leave the system (false for the log-only fallback). */
  readonly delivers: boolean;
  /** Rejects when the provider did not accept the message. */
  send(message: MailMessage): Promise<void>;
}

/**
 * Fallback used when no e-mail provider is configured. It never sends anything. Outside
 * production it logs the message so developers can test the flows; in production it logs only
 * that a message was skipped, because a live password-reset link in the logs would let anyone
 * with log access take over the account. Admins can generate a reset link from Admin → Users.
 */
@Injectable()
export class LogMailer implements Mailer {
  readonly delivers = false;
  private readonly logger = new Logger('Mailer');

  async send(message: MailMessage) {
    if (env.NODE_ENV === 'production') {
      this.logger.warn(
        `"${message.tag}" e-mail to ${message.to.email} was not sent: no e-mail provider is configured.`,
      );
      return;
    }
    this.logger.log(`[${message.tag}] to ${message.to.email}: ${message.subject}\n${message.text}`);
  }
}
