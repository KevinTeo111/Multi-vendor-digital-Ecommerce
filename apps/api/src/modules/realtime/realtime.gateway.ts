import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role, UserStatus } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { env, webOrigins } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../../common/types/auth-user';

/**
 * Socket.IO namespace `/realtime`. Clients authenticate with the same access token as the REST API
 * (`auth: { token }` in the handshake) and are placed in rooms:
 *   user:<id>        every connection of that user
 *   vendor:<id>      the vendor's dashboard sessions
 *   role:ADMIN       all admin sessions
 * Services publish through RealtimeService; nothing is ever received from clients.
 */
@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: webOrigins, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('Realtime gateway ready on /realtime');
  }

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.bearer(client.handshake.headers.authorization);
    if (!token) return client.disconnect(true);

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, { secret: env.JWT_ACCESS_SECRET });
    } catch {
      return client.disconnect(true);
    }
    if (payload.type !== 'access') return client.disconnect(true);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true, vendor: { select: { id: true } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE) return client.disconnect(true);

    await client.join(`user:${user.id}`);
    if (user.vendor) await client.join(`vendor:${user.vendor.id}`);
    if (user.role === Role.ADMIN) await client.join('role:ADMIN');
    client.emit('ready', { userId: user.id, role: user.role });
  }

  private bearer(header?: string) {
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }
}
