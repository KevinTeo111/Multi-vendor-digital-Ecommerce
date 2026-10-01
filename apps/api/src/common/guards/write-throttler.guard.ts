import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Limits only requests that change something. Reads are skipped because the web app's
 * server-side rendering calls the API from a few shared Vercel addresses: a per-IP limit on
 * reads would start refusing catalogue pages for real visitors. Brute force and spam always
 * arrive as writes (login, register, password reset, checkout), which stay limited.
 */
@Injectable()
export class WriteThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    return READ_METHODS.has(req.method) || super.shouldSkip(context);
  }
}
