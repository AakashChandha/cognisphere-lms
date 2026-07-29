import {
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

  async update(id: string, dto: UpdateUserDto): Promise<UserWithRoles> {
    await this.findByIdOrThrow(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          isActive: dto.isActive,
        },
      });

      if (dto.roles) {
        const roles = await tx.role.findMany({ where: { name: { in: dto.roles } } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: id, roleId: role.id })),
        });
      }
    });

    return this.findByIdOrThrow(id);
  }

  async setActive(id: string, isActive: boolean): Promise<UserWithRoles> {
    await this.findByIdOrThrow(id);
    await this.prisma.user.update({ where: { id }, data: { isActive } });
    return this.findByIdOrThrow(id);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.findByIdOrThrow(id);
    const passwordHash = await hashValue(newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash: newPasswordHash } });
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.user.delete({ where: { id } });
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
      roles: user.userRoles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
    };
  }
}
