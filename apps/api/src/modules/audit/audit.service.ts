import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records an audit entry. Never throws: auditing must not break the main flow. */
  async log(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for ${entry.action}`, err as Error);
    }
  }
}
