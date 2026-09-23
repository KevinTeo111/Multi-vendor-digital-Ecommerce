import { Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
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
   * Payment provider callback. Signature is verified against the raw body; the event
   * is stored and processed exactly once by (provider, eventId).
   */
  @Public()
  @Post('payments')
  @HttpCode(200)
  async payments(
    @Req() req: RawBodyRequest,
    @Body() body: unknown,
    @Headers('x-hub-signature') hubSignature?: string,
    @Headers('x-signature') signature?: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    if (!this.webhooks.verify(raw, hubSignature ?? signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.webhooks.handle(body);
  }
}
