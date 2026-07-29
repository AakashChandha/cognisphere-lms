import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles as RequireRoles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/constants/roles.constant';

/**
 * Master role management. Roles are a fixed enum for this LMS (Master, Tutor,
 * Student) seeded at startup; this endpoint lets the Master UI list them for
 * assignment when creating/updating users.
 */
@ApiTags('Master - Users')
@ApiBearerAuth('access-token')
@RequireRoles(AppRole.MASTER)
@Controller('master/roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all available roles' })
  async findAll() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }
}
