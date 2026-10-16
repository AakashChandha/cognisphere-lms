import { AppRole } from '../constants/roles.constant';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  roles: AppRole[];
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: AppRole[];
  mustChangePassword: boolean;
}
