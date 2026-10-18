import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashValue } from '../../common/utils/hash.util';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { AppRole } from '../../common/constants/roles.constant';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

type UserWithRoles = User & { userRoles: { role: { name: AppRole } }[] };

const USER_WITH_ROLES_INCLUDE = {
  userRoles: { include: { role: true } },
} satisfies Prisma.UserInclude;

/**
 * Owns persistence and lifecycle for the `User` aggregate (identity, roles,
 * activation state). Acts as the repository/service layer over Prisma for
 * everything identity-related; `AuthService`, `StudentsService`,
 * `TutorsService` and the Master user-management controllers all build on
 * top of this instead of touching Prisma directly, avoiding duplicated logic.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  async findByIdOrThrow(id: string): Promise<UserWithRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_WITH_ROLES_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(dto: CreateUserDto): Promise<UserWithRoles> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await hashValue(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        // Admin-minted temporary password: the user picks their own at first sign-in.
        mustChangePassword: true,
        userRoles: {
          create: dto.roles.map((roleName) => ({
            role: { connect: { name: roleName } },
          })),
        },
        ...(dto.roles.includes(AppRole.STUDENT) ? { student: { create: {} } } : {}),
        ...(dto.roles.includes(AppRole.TUTOR) ? { tutor: { create: {} } } : {}),
      },
      include: USER_WITH_ROLES_INCLUDE,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string): Promise<UserWithRoles> {
    const target = await this.findByIdOrThrow(id);

    if (dto.isActive === false) {
      await this.assertCanDeactivate(target, actorId);
    }

    // Role is fixed at creation: there is no business case for changing it, so it is not editable here.
    await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: dto.isActive,
      },
    });

    return this.findByIdOrThrow(id);
  }

  async setActive(id: string, isActive: boolean, actorId?: string): Promise<UserWithRoles> {
    const target = await this.findByIdOrThrow(id);
    if (!isActive) {
      await this.assertCanDeactivate(target, actorId);
    }
    await this.prisma.user.update({ where: { id }, data: { isActive } });
    return this.findByIdOrThrow(id);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.findByIdOrThrow(id);
    const passwordHash = await hashValue(newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Called when the user chooses their own password; clears the first-login flag. */
  async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: newPasswordHash, mustChangePassword: false },
    });
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const target = await this.findByIdOrThrow(id);
    await this.assertCanDeactivate(target, actorId);
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * Guards shared by disable, delete and role removal: an administrator can
   * never lock themselves out, and the system always keeps at least one
   * active Master account.
   */
  private async assertCanDeactivate(target: UserWithRoles, actorId?: string): Promise<void> {
    if (actorId && target.id === actorId) {
      throw new BadRequestException('You cannot disable or delete your own account');
    }
    if (this.hasRole(target, AppRole.MASTER)) {
      await this.assertNotLastActiveMaster(target);
    }
  }

  private async assertNotLastActiveMaster(target: UserWithRoles): Promise<void> {
    const otherActiveMasters = await this.prisma.user.count({
      where: {
        id: { not: target.id },
        isActive: true,
        userRoles: { some: { role: { name: AppRole.MASTER } } },
      },
    });
    if (otherActiveMasters === 0) {
      throw new BadRequestException(
        'This is the only active administrator account. Create another administrator first.',
      );
    }
  }

  private hasRole(user: UserWithRoles, role: AppRole): boolean {
    return user.userRoles.some((ur) => ur.role.name === role);
  }

  async findAllPaginated(query: QueryUserDto): Promise<PaginatedResult<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.role ? { userRoles: { some: { role: { name: query.role } } } } : {}),
    };

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: USER_WITH_ROLES_INCLUDE,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(
      users.map((u) => this.toResponseDto(u)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  toResponseDto(user: UserWithRoles): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      roles: user.userRoles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
    };
  }
}
