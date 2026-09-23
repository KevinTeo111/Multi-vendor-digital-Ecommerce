import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Restricts a route to the given roles. ADMIN is not implicitly allowed; list it explicitly. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
