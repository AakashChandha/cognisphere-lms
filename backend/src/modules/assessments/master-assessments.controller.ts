import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { FileStreamUrlDto } from '../course-files/dto/file-stream-url.dto';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { UpsertQuestionDto } from './dto/upsert-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { GradeAttemptDto } from './dto/grade-attempt.dto';
import { QueryAttemptsDto } from './dto/query-attempts.dto';
import { AssessmentSummaryDto } from './dto/assessment-response.dto';
import { AttemptSummaryDto } from './dto/attempt-response.dto';

/**
 * The Master twin of `tutor-assessments.controller.ts`: identical routes
 * under `/master`, mounted on the same service. Ownership is bypassed for
 * MASTER inside `CoursesService.assertTutorOwnsCourse`, so an admin can
 * author and grade on any course without a second rule set.
 */
@ApiTags('Master - Assessments')
@ApiBearerAuth('access-token')
@Roles(AppRole.MASTER)
@Controller('master')
export class MasterAssessmentsController {
  constructor(
    private readonly assessments: AssessmentsService,
    private readonly auditLog: AuditLogService,
  ) {}

  // --- Assessments ---------------------------------------------------------

  @Get('courses/:courseId/assessments')
  @ApiOperation({ summary: "List a course's assessments" })
  @ApiPaginatedResponse(AssessmentSummaryDto)
  findAllForCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.assessments.findAllForCourse(user.id, courseId, query);
  }

  @Post('courses/:courseId/assessments')
  @ApiOperation({ summary: 'Create an assessment on a course (MCQ or DOCUMENT)' })
  async create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const assessment = await this.assessments.create(user.id, courseId, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_CREATED,
      entityType: 'Assessment',
      entityId: assessment.id,
      metadata: { courseId, type: assessment.type },
      ipAddress: req.ip,
    });
    return { message: 'Assessment created successfully', data: assessment };
  }

  @Get('assessments/:id')
  @ApiOperation({ summary: 'Assessment detail, including the answer key' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessments.findOne(user.id, id);
  }

  @Patch('assessments/:id')
  @ApiOperation({ summary: 'Update an assessment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const assessment = await this.assessments.update(user.id, id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Assessment updated successfully', data: assessment };
  }

  @Delete('assessments/:id')
  @ApiOperation({ summary: 'Delete an assessment (refused once it has attempts)' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.assessments.remove(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_DELETED,
      entityType: 'Assessment',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Assessment deleted successfully', data: null };
  }

  @Post('assessments/:id/publish')
  @ApiOperation({ summary: 'Publish an assessment so enrolled students can take it' })
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const assessment = await this.assessments.publish(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_PUBLISHED,
      entityType: 'Assessment',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Assessment published successfully', data: assessment };
  }

  @Post('assessments/:id/unpublish')
  @ApiOperation({ summary: 'Take an assessment back to draft' })
  async unpublish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const assessment = await this.assessments.unpublish(user.id, id);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UNPUBLISHED,
      entityType: 'Assessment',
      entityId: id,
      ipAddress: req.ip,
    });
    return { message: 'Assessment unpublished', data: assessment };
  }

  // --- Questions (MCQ) -----------------------------------------------------

  @Post('assessments/:id/questions')
  @ApiOperation({ summary: 'Add an MCQ question with its options inline' })
  async addQuestion(
    @Param('id') id: string,
    @Body() dto: UpsertQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const question = await this.assessments.addQuestion(user.id, id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: id,
      metadata: { questionAdded: question.id },
      ipAddress: req.ip,
    });
    return { message: 'Question added successfully', data: question };
  }

  // Declared before `questions/:questionId` so "reorder" is never read as an id.
  @Patch('assessments/:id/questions/reorder')
  @ApiOperation({ summary: 'Reorder the questions of an assessment (drag and drop)' })
  async reorderQuestions(
    @Param('id') id: string,
    @Body() dto: ReorderQuestionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const questions = await this.assessments.reorderQuestions(user.id, id, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: id,
      metadata: { reorder: dto.questionIds },
      ipAddress: req.ip,
    });
    return { message: 'Question order saved', data: questions };
  }

  @Patch('assessments/:id/questions/:questionId')
  @ApiOperation({ summary: 'Update a question; the option set is replaced wholesale' })
  async updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpsertQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const question = await this.assessments.updateQuestion(user.id, id, questionId, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: id,
      metadata: { questionUpdated: questionId },
      ipAddress: req.ip,
    });
    return { message: 'Question updated successfully', data: question };
  }

  @Delete('assessments/:id/questions/:questionId')
  @ApiOperation({ summary: 'Delete a question' })
  async removeQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.assessments.removeQuestion(user.id, id, questionId);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: id,
      metadata: { questionDeleted: questionId },
      ipAddress: req.ip,
    });
    return { message: 'Question deleted successfully', data: null };
  }

  // --- Question paper (DOCUMENT) ------------------------------------------

  @Post('assessments/:id/question-paper')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload (or replace) the PDF question paper of a DOCUMENT assessment' })
  async uploadQuestionPaper(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    const paper = await this.assessments.uploadQuestionPaper(user.id, id, {
      tempPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: id,
      metadata: { questionPaperUploaded: paper.id, originalName: paper.originalName },
      ipAddress: req.ip,
    });
    return { message: 'Question paper uploaded successfully', data: paper };
  }

  @Delete('assessments/:id/question-paper/:fileId')
  @ApiOperation({ summary: 'Remove the question paper of a DOCUMENT assessment' })
  async removeQuestionPaper(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.assessments.removeQuestionPaper(user.id, id, fileId);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: id,
      metadata: { questionPaperDeleted: fileId },
      ipAddress: req.ip,
    });
    return { message: 'Question paper removed', data: null };
  }

  // --- Attempts ------------------------------------------------------------

  @Get('assessment-attempts')
  @ApiOperation({
    summary: 'Review queue: attempts across every course the actor can see (filter ?status=SUBMITTED)',
  })
  @ApiPaginatedResponse(AttemptSummaryDto)
  findAttempts(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryAttemptsDto) {
    return this.assessments.findAttemptsForActor(user.id, query);
  }

  @Get('assessments/:id/attempts')
  @ApiOperation({ summary: "Attempts at one assessment, by every student" })
  @ApiPaginatedResponse(AttemptSummaryDto)
  findAttemptsForAssessment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAttemptsDto,
  ) {
    return this.assessments.findAttemptsForAssessment(user.id, id, query);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: "Attempt detail: the student's answers, or their uploaded submission" })
  findAttempt(@Param('attemptId') attemptId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessments.findAttempt(user.id, attemptId);
  }

  @Post('attempts/:attemptId/grade')
  @ApiOperation({ summary: 'Grade a DOCUMENT attempt (MCQ attempts grade themselves)' })
  async gradeAttempt(
    @Param('attemptId') attemptId: string,
    @Body() dto: GradeAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const attempt = await this.assessments.gradeAttempt(user.id, attemptId, dto);
    await this.auditLog.record({
      actorId: user.id,
      action: AuditAction.ASSESSMENT_GRADED,
      entityType: 'AssessmentAttempt',
      entityId: attemptId,
      metadata: { status: attempt.status, scorePercent: attempt.scorePercent },
      ipAddress: req.ip,
    });
    return { message: 'Attempt graded successfully', data: attempt };
  }

  @Post('attempts/:attemptId/files/:fileId/stream-url')
  @ApiOperation({ summary: "Signed URL to read a student's submitted document" })
  @ApiOkResponse({ type: FileStreamUrlDto })
  createSubmissionStreamUrl(
    @Param('attemptId') attemptId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessments.createSubmissionStreamUrl(user.id, attemptId, fileId);
  }
}
