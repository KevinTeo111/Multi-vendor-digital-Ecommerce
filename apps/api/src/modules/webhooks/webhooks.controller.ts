import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { WebhooksService } from './webhooks.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  /**
   * Payment provider callback. The gateway adapter authenticates the request (Stripe signs the raw
   * body, Mercado Pago signs the query-string id); the event is then stored and processed once.
   */
  @Public()
  @Post('payments')
  @HttpCode(200)
  payments(@Req() req: RawBodyRequest) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.webhooks.handle(raw, req.headers, req.query as Record<string, unknown>);
  }
}
