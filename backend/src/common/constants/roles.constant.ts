import { RoleName } from '@prisma/client';

/**
 * Canonical role names used across guards, decorators and seed data. Reuses
 * Prisma's generated `RoleName` enum directly (single source of truth for
 * role values, defined once in `schema.prisma`) instead of maintaining a
 * parallel, easily-out-of-sync copy.
 */
export const AppRole = RoleName;
export type AppRole = RoleName;

export const ALL_ROLES: AppRole[] = [AppRole.MASTER, AppRole.TUTOR, AppRole.STUDENT];
