import { Body, Controller, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
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
   * Payment provider callback. The request is authenticated by the gateway adapter
   * (HMAC or basic auth); the event is then stored and processed exactly once.
   */
  @Public()
  @Post('payments')
  @HttpCode(200)
  async payments(@Req() req: RawBodyRequest, @Body() body: unknown) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    if (!this.webhooks.verify(raw, req.headers)) {
      throw new UnauthorizedException('Webhook authentication failed');
    }
    return this.webhooks.handle(body);
  }
}
