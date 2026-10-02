import { Logger } from '@nestjs/common';
import type { MailMessage, Mailer } from './mailer';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

export interface BrevoConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/** Sends through Brevo's transactional e-mail API (plain REST, no SDK). */
export class BrevoMailer implements Mailer {
  readonly delivers = true;
  private readonly logger = new Logger('Mailer');

  constructor(private readonly config: BrevoConfig) {}

  async send(message: MailMessage) {
    const res = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': this.config.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.config.fromEmail, name: this.config.fromName },
        to: [{ email: message.to.email, name: message.to.name }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        tags: [message.tag],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      throw new Error(
        `Brevo refused the message (HTTP ${res.status}${body?.code ? `, ${body.code}` : ''}): ${body?.message ?? 'no details'}`,
      );
    }
    const { messageId } = (await res.json().catch(() => ({}))) as { messageId?: string };
    this.logger.log(
      `"${message.tag}" e-mail sent to ${message.to.email} (${messageId ?? 'no id'})`,
    );
  }
}
