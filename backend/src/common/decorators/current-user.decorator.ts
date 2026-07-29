import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Extracts the authenticated user attached to the request by `JwtAuthGuard`.
 * Usage: `@CurrentUser() user: AuthenticatedUser` or `@CurrentUser('id') id: string`.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return field ? request.user?.[field] : request.user;
  },
);
