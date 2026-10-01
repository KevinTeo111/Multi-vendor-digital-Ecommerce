import { Global, Module } from '@nestjs/common';
import { LogMailer, MAILER } from './mailer';

/** Exposes MAILER. Swap the class here when a real e-mail provider is added. */
@Global()
@Module({
  providers: [{ provide: MAILER, useClass: LogMailer }],
  exports: [MAILER],
})
export class MailModule {}
