import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AuditAction } from '@prisma/client';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { compareValue, hashValue } from '../../common/utils/hash.util';
import { parseDurationToSeconds } from '../../common/utils/duration.util';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
} from '../../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been disabled. Contact an administrator.');
    }

    const passwordMatches = await compareValue(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokenPair(user.id, ipAddress);

    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.AUTH_LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return { ...tokens, user: this.usersService.toResponseDto(user) };
  }

  async refresh(rawRefreshToken: string, ipAddress?: string): Promise<AuthTokensDto> {
    const payload = this.verifyRefreshToken(rawRefreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    const matches = await compareValue(rawRefreshToken, tokenRecord.tokenHash);
    if (!matches) {
      // Token reuse detected: revoke every active session for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // Not audited: a refresh happens every 15 minutes per active user and would
    // make up most of the audit log while recording nothing anyone acts on.
    return this.issueTokenPair(tokenRecord.userId, ipAddress);
  }

  async logout(rawRefreshToken: string, userId: string, ipAddress?: string): Promise<void> {
    try {
      const payload = this.verifyRefreshToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.tokenId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Already invalid/expired tokens are effectively logged out; ignore.
    }

    await this.auditLog.record({
      actorId: userId,
      action: AuditAction.AUTH_LOGOUT,
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string): Promise<void> {
    const user = await this.usersService.findByIdOrThrow(userId);

    const matches = await compareValue(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newHash = await hashValue(dto.newPassword);
    await this.usersService.updatePassword(userId, newHash);

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.record({
      actorId: userId,
      action: AuditAction.AUTH_PASSWORD_CHANGED,
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });
  }

  private async issueTokenPair(userId: string, ipAddress?: string): Promise<AuthTokensDto> {
    const user = await this.usersService.findByIdOrThrow(userId);

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      roles: user.userRoles.map((ur) => ur.role.name),
      type: 'access',
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessExpiresIn as JwtSignOptions['expiresIn'],
    });

    const tokenId = randomUUID();
    const refreshPayload: JwtRefreshPayload = { sub: user.id, tokenId, type: 'refresh' };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.jwt.refreshSecret,
      expiresIn: this.config.jwt.refreshExpiresIn as JwtSignOptions['expiresIn'],
    });

    // Drop this user's dead tokens so the table holds only live sessions. A missing
    // row is rejected by refresh() exactly like a revoked one.
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: new Date() } }] },
    });

    const refreshSeconds = parseDurationToSeconds(this.config.jwt.refreshExpiresIn);
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash: await hashValue(refreshToken),
        expiresAt: new Date(Date.now() + refreshSeconds * 1000),
        createdByIp: ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseDurationToSeconds(this.config.jwt.accessExpiresIn),
    };
  }

  private verifyRefreshToken(rawRefreshToken: string): JwtRefreshPayload {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(rawRefreshToken, {
        secret: this.config.jwt.refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new Error('wrong-type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }
  }
}
