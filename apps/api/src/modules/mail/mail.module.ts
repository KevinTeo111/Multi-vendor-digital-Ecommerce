import { Global, Module } from '@nestjs/common';
import { env } from '../../config/env';
import { BrevoMailer } from './brevo.mailer';
import { LogMailer, MAILER, type Mailer } from './mailer';
import { NotificationsService } from './notifications.service';

function createMailer(): Mailer {
  if (!env.BREVO_API_KEY) return new LogMailer();
  if (!env.MAIL_FROM_EMAIL)
    throw new Error('MAIL_FROM_EMAIL is required when BREVO_API_KEY is set');
  return new BrevoMailer({
    apiKey: env.BREVO_API_KEY,
    fromEmail: env.MAIL_FROM_EMAIL,
    fromName: env.MAIL_FROM_NAME,
  });
}

/** Exposes the automatic e-mails. The provider is chosen from configuration: Brevo, or log-only. */
@Global()
@Module({
  providers: [{ provide: MAILER, useFactory: createMailer }, NotificationsService],
  exports: [MAILER, NotificationsService],
})
export class MailModule {}
