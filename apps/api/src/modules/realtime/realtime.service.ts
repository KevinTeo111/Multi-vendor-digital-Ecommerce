import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

export type RealtimeEvent =
  | 'product.status' // vendor: a product changed status (approved / rejected / blocked / unblocked)
  | 'product.submitted' // admins: a product entered the review queue
  | 'withdrawal.status' // vendor: a withdrawal was approved / paid / rejected / failed
  | 'withdrawal.requested' // admins: a vendor requested a withdrawal
  | 'sale.new' // vendor: one of their products was sold
  | 'subscription.status' // vendor: plan subscription activated / past due / canceled
  | 'order.paid'; // buyer: an order was confirmed

/** Thin publisher used by domain services. Never throws: realtime is best-effort. */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  toUser(userId: string, event: RealtimeEvent, payload: Record<string, unknown>) {
    this.emit(`user:${userId}`, event, payload);
  }

  toVendor(vendorId: string, event: RealtimeEvent, payload: Record<string, unknown>) {
    this.emit(`vendor:${vendorId}`, event, payload);
  }

  toAdmins(event: RealtimeEvent, payload: Record<string, unknown>) {
    this.emit('role:ADMIN', event, payload);
  }

  private emit(room: string, event: RealtimeEvent, payload: Record<string, unknown>) {
    try {
      this.gateway.server?.to(room).emit(event, { ...payload, at: new Date().toISOString() });
    } catch (err) {
      this.logger.warn(`Failed to emit ${event} to ${room}: ${(err as Error).message}`);
    }
  }
}
