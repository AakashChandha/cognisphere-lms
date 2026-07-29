import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditAction } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { UsersService } from './users.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Master-only user management: create, update, activate/deactivate, reset
 * password and delete any user regardless of role.
 */
@ApiTags('Master - Users')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all users with search, filter and pagination' })
  @ApiPaginatedResponse(UserResponseDto)
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAllPaginated(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by id' })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findByIdOrThrow(id);
    return this.usersService.toResponseDto(user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user (Master, Tutor or Student)' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const user = await this.usersService.create(dto);
    await this.auditLog.record({
      actorId: actor.id,
      action: AuditAction.USER_CREATED,
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });
    return { message: 'User created successfully', data: this.usersService.toResponseDto(user) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user profile or role assignment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const user = await this.usersService.update(id, dto);
    await this.auditLog.record({
      actorId: actor.id,
      action: AuditAction.USER_UPDATED,
      entityType: 'User',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'User updated successfully', data: this.usersService.toResponseDto(user) };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Enable or disable a user account' })
  async setActive(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const user = await this.usersService.setActive(id, isActive);
    await this.auditLog.record({
      actorId: actor.id,
      action: isActive ? AuditAction.USER_ENABLED : AuditAction.USER_DISABLED,
      entityType: 'User',
      entityId: id,
      ipAddress: req.ip,
    });
    return {
      message: `User ${isActive ? 'enabled' : 'disabled'} successfully`,
      data: this.usersService.toResponseDto(user),
    };
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a user password (Master action)' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.usersService.resetPassword(id, dto.newPassword);
    await this.auditLog.record({
      actorId: actor.id,
      action: AuditAction.USER_PASSWORD_RESET,
      entityType: 'User',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Password reset successfully', data: null };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user permanently' })
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Request) {
    await this.usersService.remove(id);
    await this.auditLog.record({
      actorId: actor.id,
      action: AuditAction.USER_DELETED,
      entityType: 'User',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'User deleted successfully', data: null };
  }
}
