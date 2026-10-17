import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditAction } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { FileStreamUrlDto } from '../course-files/dto/file-stream-url.dto';
import { AssessmentsService } from './assessments.service';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { QueryAttemptsDto } from './dto/query-attempts.dto';
import { AttemptSummaryDto } from './dto/attempt-response.dto';
import { StudentAssessmentSummaryDto } from './dto/student-assessment-response.dto';

/**
 * The student side of assessments. Everything here is scoped to PUBLISHED
 * assessments of PUBLISHED, non-deactivated courses the student is enrolled
 * in; anything else is a 404, so the existence of drafts never leaks.
 */
@ApiTags('Students')
@ApiBearerAuth('access-token')
@Roles(AppRole.STUDENT)
@Controller('student')
export class StudentAssessmentsController {
  constructor(
    private readonly assessments: AssessmentsService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('courses/:courseId/assessments')
  @ApiOperation({ summary: 'Assessments available on one enrolled course' })
  @ApiOkResponse({ type: [StudentAssessmentSummaryDto] })
  findAllForCourse(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessments.findAllForStudentCourse(user.id, courseId);
  }

  @Get('assessments/:id')
  @ApiOperation({ summary: 'Assessment detail. MCQ options never carry the answer key.' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessments.findOneForStudent(user.id, id);
  }

  @Post('assessments/:id/attempts')
  @ApiOperation({
    summary: 'Start an attempt. Resumes an unfinished one; refuses a retake after a pass.',
  })
  async startAttempt(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const attempt = await this.assessments.startAttempt(user.id, id);
    return { message: 'Attempt started', data: attempt };
  }

  @Post('attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Submit MCQ answers; graded immediately against the pass mark' })
  async submit(
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const attempt = await this.assessments.submitMcqAttempt(user.id, attemptId, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_SUBMITTED,
      entityType: 'AssessmentAttempt',
      entityId: attempt.id,
      metadata: { status: attempt.status, scorePercent: attempt.scorePercent },
      ipAddress: req.ip,
    });
    return { message: 'Attempt submitted', data: attempt };
  }

  @Post('attempts/:attemptId/document')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload the completed PDF for a DOCUMENT assessment' })
  async uploadDocument(
    @Param('attemptId') attemptId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    const attempt = await this.assessments.uploadSubmission(user.id, attemptId, {
      tempPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_SUBMITTED,
      entityType: 'AssessmentAttempt',
      entityId: attempt.id,
      metadata: { originalName: file.originalname },
      ipAddress: req.ip,
    });
    return { message: 'Submission uploaded', data: attempt };
  }

  @Get('attempts')
  @ApiOperation({ summary: 'My attempts across every enrolled course' })
  @ApiPaginatedResponse(AttemptSummaryDto)
  findMyAttempts(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryAttemptsDto) {
    return this.assessments.findMyAttempts(user.id, query);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'One of my attempts, with the score, feedback and grader' })
  findMyAttempt(@Param('attemptId') attemptId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessments.findMyAttempt(user.id, attemptId);
  }

  @Post('assessments/:id/question-paper/stream-url')
  @ApiOperation({ summary: 'Signed URL to read the question paper in the browser' })
  @ApiOkResponse({ type: FileStreamUrlDto })
  createQuestionPaperStreamUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessments.createQuestionPaperStreamUrl(user.id, id);
  }

  @Post('attempts/:attemptId/files/:fileId/stream-url')
  @ApiOperation({ summary: 'Signed URL to re-read a document I submitted' })
  @ApiOkResponse({ type: FileStreamUrlDto })
  createMySubmissionStreamUrl(
    @Param('attemptId') attemptId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessments.createMySubmissionStreamUrl(user.id, attemptId, fileId);
  }
}
