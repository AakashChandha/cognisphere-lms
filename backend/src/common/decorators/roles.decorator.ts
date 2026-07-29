import { SetMetadata } from '@nestjs/common';
import { AppRole } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles. Combine with the global
 * `JwtAuthGuard` + `RolesGuard` to enforce role-based authorization.
 */
export const Roles = (...roles: AppRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
