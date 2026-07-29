import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppRole } from '../../common/constants/roles.constant';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

/**
 * Single source of truth for "read/update the current user's profile"
 * regardless of role. Student, Tutor and Master profile endpoints all
 * delegate here instead of duplicating the same User(+role table) update
 * logic three times.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } }, student: true, tutor: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponseDto(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } }, student: true, tutor: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatarUrl: dto.avatarUrl,
        },
      });

      if (user.student) {
        await tx.student.update({
          where: { userId },
          data: { phone: dto.phone, bio: dto.bio },
        });
      }

      if (user.tutor) {
        await tx.tutor.update({
          where: { userId },
          data: { phone: dto.phone, bio: dto.bio, expertise: dto.expertise },
        });
      }
    });

    return this.getProfile(userId);
  }

  private toResponseDto(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    createdAt: Date;
    userRoles: { role: { name: AppRole } }[];
    student: { phone: string | null; bio: string | null } | null;
    tutor: { phone: string | null; bio: string | null; expertise: string | null } | null;
  }): ProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      roles: user.userRoles.map((ur) => ur.role.name),
      phone: user.student?.phone ?? user.tutor?.phone ?? null,
      bio: user.student?.bio ?? user.tutor?.bio ?? null,
      expertise: user.tutor?.expertise ?? null,
      createdAt: user.createdAt,
    };
  }
}
