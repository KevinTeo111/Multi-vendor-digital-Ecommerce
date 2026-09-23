import type { Role } from '@prisma/client';

/** The authenticated principal attached to each request by the JWT strategy. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  /** Present only for users with role VENDOR. */
  vendorId: string | null;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  type: 'access' | 'refresh';
}
