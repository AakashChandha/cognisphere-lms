import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentStatus,
  AssessmentType,
  AttemptStatus,
  CourseStatus,
  FilePurpose,
  Prisma,
  RoleName,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeAssessmentStanding } from './assessment-standing.util';
import { AppConfigService } from '../../config/app-config.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildPaginatedResult } from '../../common/utils/pagination.util';
import { CoursesService } from '../courses/courses.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { LocalStorageService } from '../storage/local-storage.service';
import { StreamTokenService } from '../storage/stream-token.service';
import { FileStreamUrlDto } from '../course-files/dto/file-stream-url.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { UpsertQuestionDto } from './dto/upsert-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { GradeAttemptDto } from './dto/grade-attempt.dto';
import { QueryAttemptsDto } from './dto/query-attempts.dto';
import {
  AssessmentDetailDto,
  AssessmentFileDto,
  AssessmentQuestionDto,
  AssessmentSummaryDto,
} from './dto/assessment-response.dto';
import {
  StudentAssessmentDetailDto,
  StudentAssessmentStatus,
  StudentAssessmentSummaryDto,
} from './dto/student-assessment-response.dto';
import { AttemptDetailDto, AttemptSummaryDto } from './dto/attempt-response.dto';

const QUESTION_INCLUDE = {
  options: { orderBy: { orderIndex: 'asc' } },
} satisfies Prisma.AssessmentQuestionInclude;

const ASSESSMENT_INCLUDE = {
  course: { select: { id: true, title: true, tutorId: true } },
  questions: { orderBy: { orderIndex: 'asc' }, include: QUESTION_INCLUDE },
  papers: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.AssessmentInclude;

const ATTEMPT_SUMMARY_INCLUDE = {
  assessment: { include: { course: { select: { id: true, title: true } } } },
  student: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
} satisfies Prisma.AssessmentAttemptInclude;

const ATTEMPT_DETAIL_INCLUDE = {
  assessment: {
    include: {
      course: { select: { id: true, title: true } },
      questions: { orderBy: { orderIndex: 'asc' }, include: QUESTION_INCLUDE },
    },
  },
  student: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
  gradedBy: { select: { id: true, firstName: true, lastName: true } },
  answers: true,
  submissions: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.AssessmentAttemptInclude;

type AssessmentWithRelations = Prisma.AssessmentGetPayload<{ include: typeof ASSESSMENT_INCLUDE }>;
type AttemptWithDetail = Prisma.AssessmentAttemptGetPayload<{ include: typeof ATTEMPT_DETAIL_INCLUDE }>;

/** Attempt totals per assessment, counted in one group-by instead of N queries. */
interface AttemptCounts {
  attemptCount: number;
  awaitingReviewCount: number;
}

/**
 * Structural view of what `AttemptSummaryDto` needs, so the summary mapper
 * accepts both the light list payload and the heavier detail payload.
 */
interface AttemptSummarySource {
  id: string;
  assessmentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  scorePercent: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  gradedAt: Date | null;
  assessment: {
    id: string;
    title: string;
    type: AssessmentType;
    passPercent: number;
    courseId: string;
    course: { id: string; title: string };
  };
  student: { id: string; user: { firstName: string; lastName: string; email: string } };
}

/** Where Multer streamed the upload to, inside the storage volume. */
export interface AssessmentUploadArgs {
  tempPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

function isPdfUpload(originalName: string, mimeType: string): boolean {
  const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
  return ext === 'pdf' || (mimeType || '').toLowerCase() === 'application/pdf';
}

/**
 * Owns the whole assessment aggregate: authoring (questions, options, the
 * question paper), the student take/submit flow with MCQ auto-grading, and
 * the tutor review queue. Mounted by the tutor, master and student
 * controllers so the ownership, visibility and grading rules live once.
 *
 * MASTER is accepted everywhere TUTOR is: `CoursesService.assertTutorOwnsCourse`
 * passes a master through for any course.
 */
@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly config: AppConfigService,
    private readonly localStorage: LocalStorageService,
    private readonly streamTokens: StreamTokenService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  // -------------------------------------------------------------------------
  // Authoring - TUTOR (own courses) / MASTER (any course)
  // -------------------------------------------------------------------------

  async findAllForCourse(
    actorUserId: string,
    courseId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<AssessmentSummaryDto>> {
    await this.coursesService.assertTutorOwnsCourse(actorUserId, courseId, { forRead: true });

    const where: Prisma.AssessmentWhereInput = {
      courseId,
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [assessments, totalItems] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        include: ASSESSMENT_INCLUDE,
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.assessment.count({ where }),
    ]);

    const counts = await this.countAttempts(assessments.map((a) => a.id));

    return buildPaginatedResult(
      assessments.map((a) => this.toSummaryDto(a, counts.get(a.id))),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  async create(
    actorUserId: string,
    courseId: string,
    dto: CreateAssessmentDto,
  ): Promise<AssessmentDetailDto> {
    await this.coursesService.assertTutorOwnsCourse(actorUserId, courseId);

    const orderIndex = await this.prisma.assessment.count({ where: { courseId } });

    const assessment = await this.prisma.assessment.create({
      data: {
        courseId,
        type: dto.type,
        title: dto.title,
        instructions: dto.instructions ?? '',
        passPercent: dto.passPercent ?? 70,
        // A time limit only makes sense for a timed MCQ run.
        timeLimitMinutes: dto.type === AssessmentType.MCQ ? (dto.timeLimitMinutes ?? null) : null,
        orderIndex,
      },
      include: ASSESSMENT_INCLUDE,
    });

    return this.toDetailDto(assessment, { attemptCount: 0, awaitingReviewCount: 0 });
  }

  async findOne(actorUserId: string, assessmentId: string): Promise<AssessmentDetailDto> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId, { forRead: true });
    const counts = await this.countAttempts([assessment.id]);
    return this.toDetailDto(assessment, counts.get(assessment.id));
  }

  async update(
    actorUserId: string,
    assessmentId: string,
    dto: UpdateAssessmentDto,
  ): Promise<AssessmentDetailDto> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);

    const updated = await this.prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        title: dto.title,
        instructions: dto.instructions,
        passPercent: dto.passPercent,
        timeLimitMinutes:
          dto.timeLimitMinutes === undefined
            ? undefined
            : assessment.type === AssessmentType.MCQ
              ? dto.timeLimitMinutes
              : null,
      },
      include: ASSESSMENT_INCLUDE,
    });

    const counts = await this.countAttempts([updated.id]);
    return this.toDetailDto(updated, counts.get(updated.id));
  }

  /** Refused once students have run at it, so results are never orphaned. */
  async remove(actorUserId: string, assessmentId: string): Promise<void> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);

    const attempts = await this.prisma.assessmentAttempt.count({
      where: { assessmentId: assessment.id },
    });
    if (attempts > 0) {
      throw new ConflictException(
        'Students have already attempted this assessment, so it can no longer be deleted. Unpublish it instead.',
      );
    }

    for (const paper of assessment.papers) {
      await this.storage.delete(paper.storageKey);
    }
    await this.prisma.assessment.delete({ where: { id: assessment.id } });
  }

  async publish(actorUserId: string, assessmentId: string): Promise<AssessmentDetailDto> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);

    if (assessment.status === AssessmentStatus.PUBLISHED) {
      throw new BadRequestException('This assessment is already published');
    }

    if (assessment.type === AssessmentType.MCQ) {
      if (assessment.questions.length === 0) {
        throw new BadRequestException('Add at least one question before publishing');
      }
      const broken = assessment.questions.find(
        (q) => q.options.length < 2 || q.options.filter((o) => o.isCorrect).length !== 1,
      );
      if (broken) {
        throw new BadRequestException(
          'Every question needs at least two options and exactly one correct answer. Fix: ' + broken.prompt,
        );
      }
    } else if (assessment.papers.length === 0) {
      throw new BadRequestException('Upload the question paper before publishing');
    }

    const updated = await this.prisma.assessment.update({
      where: { id: assessment.id },
      data: { status: AssessmentStatus.PUBLISHED },
      include: ASSESSMENT_INCLUDE,
    });

    const counts = await this.countAttempts([updated.id]);
    return this.toDetailDto(updated, counts.get(updated.id));
  }

  async unpublish(actorUserId: string, assessmentId: string): Promise<AssessmentDetailDto> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);

    if (assessment.status !== AssessmentStatus.PUBLISHED) {
      throw new BadRequestException('Only a published assessment can be unpublished');
    }

    const updated = await this.prisma.assessment.update({
      where: { id: assessment.id },
      data: { status: AssessmentStatus.DRAFT },
      include: ASSESSMENT_INCLUDE,
    });

    const counts = await this.countAttempts([updated.id]);
    return this.toDetailDto(updated, counts.get(updated.id));
  }

  // -------------------------------------------------------------------------
  // Questions (MCQ only) - options are authored inline with the question
  // -------------------------------------------------------------------------

  async addQuestion(
    actorUserId: string,
    assessmentId: string,
    dto: UpsertQuestionDto,
  ): Promise<AssessmentQuestionDto> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);
    this.assertMcq(assessment.type);
    this.assertOptionSet(dto);

    const orderIndex = assessment.questions.length;

    const question = await this.prisma.assessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        prompt: dto.prompt,
        points: dto.points ?? 1,
        orderIndex,
        options: {
          create: dto.options.map((o, index) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            orderIndex: index,
          })),
        },
      },
      include: QUESTION_INCLUDE,
    });

    return this.toQuestionDto(question, true);
  }

  /** Replaces the whole option set: the answer key cannot be edited piecemeal. */
  async updateQuestion(
    actorUserId: string,
    assessmentId: string,
    questionId: string,
    dto: UpsertQuestionDto,
  ): Promise<AssessmentQuestionDto> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);
    this.assertMcq(assessment.type);
    this.assertOptionSet(dto);

    const existing = assessment.questions.find((q) => q.id === questionId);
    if (!existing) {
      throw new NotFoundException('Question not found');
    }

    const question = await this.prisma.$transaction(async (tx) => {
      await tx.assessmentOption.deleteMany({ where: { questionId } });
      return tx.assessmentQuestion.update({
        where: { id: questionId },
        data: {
          prompt: dto.prompt,
          points: dto.points ?? 1,
          options: {
            create: dto.options.map((o, index) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              orderIndex: index,
            })),
          },
        },
        include: QUESTION_INCLUDE,
      });
    });

    return this.toQuestionDto(question, true);
  }

  async removeQuestion(actorUserId: string, assessmentId: string, questionId: string): Promise<void> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);
    if (!assessment.questions.some((q) => q.id === questionId)) {
      throw new NotFoundException('Question not found');
    }
    await this.prisma.assessmentQuestion.delete({ where: { id: questionId } });
  }

  /**
   * Persist a drag-and-drop order. Every question must be listed exactly
   * once so a stale client can never silently drop one.
   */
  async reorderQuestions(
    actorUserId: string,
    assessmentId: string,
    dto: ReorderQuestionsDto,
  ): Promise<AssessmentQuestionDto[]> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);

    const existingIds = new Set(assessment.questions.map((q) => q.id));
    const requested = new Set(dto.questionIds);
    if (
      requested.size !== dto.questionIds.length ||
      requested.size !== existingIds.size ||
      [...requested].some((id) => !existingIds.has(id))
    ) {
      throw new BadRequestException('The question list is out of date. Refresh and try again.');
    }

    await this.prisma.$transaction(
      dto.questionIds.map((id, orderIndex) =>
        this.prisma.assessmentQuestion.update({ where: { id }, data: { orderIndex } }),
      ),
    );

    const questions = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: assessment.id },
      include: QUESTION_INCLUDE,
      orderBy: { orderIndex: 'asc' },
    });
    return questions.map((q) => this.toQuestionDto(q, true));
  }

  // -------------------------------------------------------------------------
  // Question paper (DOCUMENT assessments)
  // -------------------------------------------------------------------------

  async uploadQuestionPaper(
    actorUserId: string,
    assessmentId: string,
    file: AssessmentUploadArgs,
  ): Promise<AssessmentFileDto> {
    let assessment: AssessmentWithRelations;
    let storageKey: string;
    try {
      assessment = await this.getForActorOrThrow(actorUserId, assessmentId);

      if (assessment.type !== AssessmentType.DOCUMENT) {
        throw new BadRequestException('Only a DOCUMENT assessment hands out a question paper');
      }
      this.assertPdf(file);

      ({ storageKey } = await this.storage.upload({
        tempPath: file.tempPath,
        originalName: file.originalName,
        mimeType: file.mimeType,
        folder: `courses/${assessment.courseId}/assessments/${assessment.id}`,
      }));
    } catch (error) {
      await this.localStorage.discardTemp(file.tempPath);
      throw error;
    }

    // One paper at a time: a re-upload replaces whatever was handed out.
    for (const paper of assessment.papers) {
      await this.storage.delete(paper.storageKey);
    }
    await this.prisma.courseFile.deleteMany({
      where: { assessmentId: assessment.id, purpose: FilePurpose.QUESTION_PAPER },
    });

    const record = await this.prisma.courseFile.create({
      data: {
        courseId: assessment.courseId,
        uploadedById: actorUserId,
        originalName: file.originalName,
        storageKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        purpose: FilePurpose.QUESTION_PAPER,
        assessmentId: assessment.id,
      },
    });

    return this.toFileDto(record);
  }

  async removeQuestionPaper(
    actorUserId: string,
    assessmentId: string,
    fileId: string,
  ): Promise<void> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId);
    const paper = assessment.papers.find((p) => p.id === fileId);
    if (!paper) {
      throw new NotFoundException('Question paper not found');
    }

    // A published DOCUMENT assessment with no paper is a dead end: students
    // see it in their list and have nothing to answer. Make the tutor
    // unpublish first, or upload a replacement, which swaps the file in place.
    if (assessment.status === AssessmentStatus.PUBLISHED && assessment.papers.length === 1) {
      throw new ConflictException(
        'Unpublish this assessment before removing its only question paper, or upload a replacement instead.',
      );
    }

    await this.storage.delete(paper.storageKey);
    await this.prisma.courseFile.delete({ where: { id: paper.id } });
  }

  // -------------------------------------------------------------------------
  // Attempts - TUTOR / MASTER review side
  // -------------------------------------------------------------------------

  async findAttemptsForAssessment(
    actorUserId: string,
    assessmentId: string,
    query: QueryAttemptsDto,
  ): Promise<PaginatedResult<AttemptSummaryDto>> {
    const assessment = await this.getForActorOrThrow(actorUserId, assessmentId, { forRead: true });
    return this.paginateAttempts(
      {
        assessmentId: assessment.id,
        ...(query.status ? { status: query.status } : {}),
      },
      query,
    );
  }

  /**
   * The cross-course review queue tutors live in. A tutor sees attempts on
   * their own courses; a master sees every course.
   */
  async findAttemptsForActor(
    actorUserId: string,
    query: QueryAttemptsDto,
  ): Promise<PaginatedResult<AttemptSummaryDto>> {
    const scope = await this.actorCourseScope(actorUserId);
    return this.paginateAttempts(
      {
        ...(query.status ? { status: query.status } : {}),
        assessment: { course: scope },
      },
      query,
    );
  }

  async findAttempt(actorUserId: string, attemptId: string): Promise<AttemptDetailDto> {
    const attempt = await this.getAttemptForActorOrThrow(actorUserId, attemptId);
    // Tutors and masters always see the answer key.
    return this.toAttemptDetailDto(attempt, true);
  }

  async gradeAttempt(
    actorUserId: string,
    attemptId: string,
    dto: GradeAttemptDto,
  ): Promise<AttemptDetailDto> {
    const attempt = await this.getAttemptForActorOrThrow(actorUserId, attemptId);

    if (attempt.assessment.type !== AssessmentType.DOCUMENT) {
      throw new BadRequestException('MCQ attempts are graded automatically on submit');
    }
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new ConflictException('This attempt has not been submitted yet');
    }

    const updated = await this.prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: dto.passed ? AttemptStatus.PASSED : AttemptStatus.FAILED,
        scorePercent: dto.scorePercent ?? attempt.scorePercent,
        feedback: dto.feedback,
        gradedAt: new Date(),
        gradedById: actorUserId,
      },
      include: ATTEMPT_DETAIL_INCLUDE,
    });

    return this.toAttemptDetailDto(updated, true);
  }

  async createSubmissionStreamUrl(
    actorUserId: string,
    attemptId: string,
    fileId: string,
  ): Promise<FileStreamUrlDto> {
    const attempt = await this.getAttemptForActorOrThrow(actorUserId, attemptId);
    const submission = attempt.submissions.find((s) => s.id === fileId);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return this.signStreamUrl(actorUserId, submission.id);
  }

  // -------------------------------------------------------------------------
  // STUDENT
  // -------------------------------------------------------------------------

  async findAllForStudentCourse(
    studentUserId: string,
    courseId: string,
  ): Promise<StudentAssessmentSummaryDto[]> {
    const student = await this.getStudentOrThrow(studentUserId);
    await this.assertCourseVisibleToStudent(student.id, courseId);

    const assessments = await this.prisma.assessment.findMany({
      where: { courseId, status: AssessmentStatus.PUBLISHED },
      include: ASSESSMENT_INCLUDE,
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    const myAttempts = await this.prisma.assessmentAttempt.findMany({
      where: { studentId: student.id, assessmentId: { in: assessments.map((a) => a.id) } },
      orderBy: { attemptNumber: 'asc' },
    });

    return assessments.map((a) =>
      this.toStudentSummaryDto(
        a,
        myAttempts.filter((att) => att.assessmentId === a.id),
      ),
    );
  }

  async findOneForStudent(
    studentUserId: string,
    assessmentId: string,
  ): Promise<StudentAssessmentDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const assessment = await this.getVisibleToStudentOrThrow(student.id, assessmentId);

    const myAttempts = await this.prisma.assessmentAttempt.findMany({
      where: { studentId: student.id, assessmentId: assessment.id },
      orderBy: { attemptNumber: 'asc' },
    });

    const summary = this.toStudentSummaryDto(assessment, myAttempts);
    const active = myAttempts.find((a) => a.status === AttemptStatus.IN_PROGRESS) ?? null;

    return {
      ...summary,
      // The student mapper strips the answer key here, not the caller.
      questions: assessment.questions.map((q) => this.toQuestionDto(q, false)),
      questionPaper: this.questionPaperOf(assessment),
      activeAttemptId: active?.id ?? null,
    };
  }

  /**
   * Retries are unlimited, but a pass is final and an unfinished attempt is
   * resumed rather than duplicated.
   */
  async startAttempt(studentUserId: string, assessmentId: string): Promise<AttemptDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const assessment = await this.getVisibleToStudentOrThrow(student.id, assessmentId);

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: { studentId: student.id, assessmentId: assessment.id },
      orderBy: { attemptNumber: 'desc' },
    });

    const inProgress = attempts.find((a) => a.status === AttemptStatus.IN_PROGRESS);
    if (inProgress) {
      return this.loadStudentAttempt(student.id, inProgress.id);
    }

    if (attempts.some((a) => a.status === AttemptStatus.PASSED)) {
      throw new ConflictException('You have already passed this assessment');
    }

    const attemptNumber = (attempts[0]?.attemptNumber ?? 0) + 1;

    const created = await this.prisma.assessmentAttempt.create({
      data: { assessmentId: assessment.id, studentId: student.id, attemptNumber },
      include: ATTEMPT_DETAIL_INCLUDE,
    });

    return this.toAttemptDetailDto(created, false);
  }

  /** MCQ only: graded the moment it lands, against `assessment.passPercent`. */
  async submitMcqAttempt(
    studentUserId: string,
    attemptId: string,
    dto: SubmitAttemptDto,
  ): Promise<AttemptDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const attempt = await this.getStudentAttemptOrThrow(student.id, attemptId);

    if (attempt.assessment.type !== AssessmentType.MCQ) {
      throw new BadRequestException('This assessment is submitted by uploading a document');
    }
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ConflictException('This attempt has already been submitted');
    }

    const questions = attempt.assessment.questions;
    const chosen = new Map<string, string>();
    for (const answer of dto.answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        throw new BadRequestException('An answer refers to a question that is not in this assessment');
      }
      if (!question.options.some((o) => o.id === answer.optionId)) {
        throw new BadRequestException('An answer refers to an option that is not on its question');
      }
      if (chosen.has(answer.questionId)) {
        throw new BadRequestException('A question was answered twice');
      }
      chosen.set(answer.questionId, answer.optionId);
    }

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const earnedPoints = questions.reduce((sum, q) => {
      const optionId = chosen.get(q.id);
      const option = optionId ? q.options.find((o) => o.id === optionId) : undefined;
      return sum + (option?.isCorrect ? q.points : 0);
    }, 0);

    // A published MCQ always has questions; guard anyway so a zero-point
    // assessment can never divide by zero.
    const scorePercent = totalPoints === 0 ? 0 : Math.round((100 * earnedPoints) / totalPoints);
    const passed = scorePercent >= attempt.assessment.passPercent;
    const submittedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.assessmentAnswer.deleteMany({ where: { attemptId: attempt.id } });
      if (chosen.size > 0) {
        await tx.assessmentAnswer.createMany({
          data: [...chosen.entries()].map(([questionId, optionId]) => ({
            attemptId: attempt.id,
            questionId,
            optionId,
          })),
        });
      }
      return tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: passed ? AttemptStatus.PASSED : AttemptStatus.FAILED,
          scorePercent,
          submittedAt,
          gradedAt: submittedAt,
        },
        include: ATTEMPT_DETAIL_INCLUDE,
      });
    });

    // Graded, so the student may now see which options were right.
    return this.toAttemptDetailDto(updated, true);
  }

  /** DOCUMENT only: uploading the completed paper is the submission. */
  async uploadSubmission(
    studentUserId: string,
    attemptId: string,
    file: AssessmentUploadArgs,
  ): Promise<AttemptDetailDto> {
    let attempt: AttemptWithDetail;
    let storageKey: string;
    try {
      const student = await this.getStudentOrThrow(studentUserId);
      attempt = await this.getStudentAttemptOrThrow(student.id, attemptId);

      if (attempt.assessment.type !== AssessmentType.DOCUMENT) {
        throw new BadRequestException('This assessment is submitted by answering the questions online');
      }
      if (attempt.status !== AttemptStatus.IN_PROGRESS) {
        throw new ConflictException('This attempt has already been submitted');
      }
      this.assertPdf(file);

      ({ storageKey } = await this.storage.upload({
        tempPath: file.tempPath,
        originalName: file.originalName,
        mimeType: file.mimeType,
        folder: `courses/${attempt.assessment.courseId}/submissions/${attempt.id}`,
      }));
    } catch (error) {
      await this.localStorage.discardTemp(file.tempPath);
      throw error;
    }

    const submittedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.courseFile.create({
        data: {
          courseId: attempt.assessment.courseId,
          uploadedById: studentUserId,
          originalName: file.originalName,
          storageKey,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          purpose: FilePurpose.SUBMISSION,
          attemptId: attempt.id,
        },
      });
      return tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { status: AttemptStatus.SUBMITTED, submittedAt },
        include: ATTEMPT_DETAIL_INCLUDE,
      });
    });

    return this.toAttemptDetailDto(updated, false);
  }

  async findMyAttempts(
    studentUserId: string,
    query: QueryAttemptsDto,
  ): Promise<PaginatedResult<AttemptSummaryDto>> {
    const student = await this.getStudentOrThrow(studentUserId);
    return this.paginateAttempts(
      {
        studentId: student.id,
        ...(query.status ? { status: query.status } : {}),
      },
      query,
    );
  }

  async findMyAttempt(studentUserId: string, attemptId: string): Promise<AttemptDetailDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    return this.loadStudentAttempt(student.id, attemptId);
  }

  async createQuestionPaperStreamUrl(
    studentUserId: string,
    assessmentId: string,
  ): Promise<FileStreamUrlDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const assessment = await this.getVisibleToStudentOrThrow(student.id, assessmentId);
    const paper = assessment.papers[0];
    if (!paper) {
      throw new NotFoundException('This assessment has no question paper');
    }
    return this.signStreamUrl(studentUserId, paper.id);
  }

  /**
   * Lets a student re-read the document they handed in. They can already see
   * the attempt's metadata, and being unable to check what was submitted makes
   * a tutor's feedback impossible to act on.
   */
  async createMySubmissionStreamUrl(
    studentUserId: string,
    attemptId: string,
    fileId: string,
  ): Promise<FileStreamUrlDto> {
    const student = await this.getStudentOrThrow(studentUserId);
    const attempt = await this.getStudentAttemptOrThrow(student.id, attemptId);
    const submission = attempt.submissions.find((sub) => sub.id === fileId);
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return this.signStreamUrl(studentUserId, submission.id);
  }

  private async loadStudentAttempt(studentId: string, attemptId: string): Promise<AttemptDetailDto> {
    const attempt = await this.getStudentAttemptOrThrow(studentId, attemptId);
    // The answer key is only ever revealed once the attempt has a verdict.
    const graded =
      attempt.status === AttemptStatus.PASSED || attempt.status === AttemptStatus.FAILED;
    return this.toAttemptDetailDto(attempt, graded);
  }

  // -------------------------------------------------------------------------
  // Access helpers
  // -------------------------------------------------------------------------

  private async getForActorOrThrow(
    actorUserId: string,
    assessmentId: string,
    options: { forRead?: boolean } = {},
  ): Promise<AssessmentWithRelations> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: ASSESSMENT_INCLUDE,
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    await this.coursesService.assertTutorOwnsCourse(actorUserId, assessment.courseId, options);
    return assessment;
  }

  private async getAttemptForActorOrThrow(
    actorUserId: string,
    attemptId: string,
  ): Promise<AttemptWithDetail> {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      include: ATTEMPT_DETAIL_INCLUDE,
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    await this.coursesService.assertTutorOwnsCourse(actorUserId, attempt.assessment.courseId, {
      forRead: true,
    });
    return attempt;
  }

  /**
   * Students get a 404 for anything they may not see - a draft assessment,
   * an unenrolled course, a deactivated one - so nothing leaks through the
   * difference between "forbidden" and "missing".
   */
  private async getVisibleToStudentOrThrow(
    studentId: string,
    assessmentId: string,
  ): Promise<AssessmentWithRelations> {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        status: AssessmentStatus.PUBLISHED,
        course: {
          status: CourseStatus.PUBLISHED,
          deactivatedAt: null,
          enrollments: { some: { studentId } },
        },
      },
      include: ASSESSMENT_INCLUDE,
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    return assessment;
  }

  private async assertCourseVisibleToStudent(studentId: string, courseId: string): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        status: CourseStatus.PUBLISHED,
        deactivatedAt: null,
        enrollments: { some: { studentId } },
      },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
  }

  private async getStudentAttemptOrThrow(
    studentId: string,
    attemptId: string,
  ): Promise<AttemptWithDetail> {
    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        studentId,
        assessment: {
          status: AssessmentStatus.PUBLISHED,
          course: {
            status: CourseStatus.PUBLISHED,
            deactivatedAt: null,
            enrollments: { some: { studentId } },
          },
        },
      },
      include: ATTEMPT_DETAIL_INCLUDE,
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    return attempt;
  }

  private async getStudentOrThrow(userId: string) {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  /** Which courses this actor may review attempts on. */
  private async actorCourseScope(actorUserId: string): Promise<Prisma.CourseWhereInput> {
    if (await this.isMaster(actorUserId)) {
      return {};
    }
    const tutor = await this.prisma.tutor.findUnique({ where: { userId: actorUserId } });
    if (!tutor) {
      throw new NotFoundException('Tutor profile not found');
    }
    return { tutorId: tutor.id };
  }

  private async isMaster(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: { userId, role: { name: RoleName.MASTER } },
    });
    return count > 0;
  }

  private assertMcq(type: AssessmentType): void {
    if (type !== AssessmentType.MCQ) {
      throw new BadRequestException(
        'Only an MCQ assessment has questions. A DOCUMENT assessment hands out a question paper instead.',
      );
    }
  }

  private assertOptionSet(dto: UpsertQuestionDto): void {
    if (dto.options.length < 2) {
      throw new BadRequestException('A question needs at least two options');
    }
    if (dto.options.filter((o) => o.isCorrect).length !== 1) {
      throw new BadRequestException('Exactly one option must be marked as the correct answer');
    }
  }

  private assertPdf(file: AssessmentUploadArgs): void {
    if (file.sizeBytes > this.config.storage.maxFileSizeBytes) {
      throw new BadRequestException('File exceeds the maximum allowed size');
    }
    if (!isPdfUpload(file.originalName, file.mimeType)) {
      throw new BadRequestException('Only PDF files can be used for assessments');
    }
  }

  // -------------------------------------------------------------------------
  // Queries & mappers
  // -------------------------------------------------------------------------

  private async paginateAttempts(
    where: Prisma.AssessmentAttemptWhereInput,
    query: QueryAttemptsDto,
  ): Promise<PaginatedResult<AttemptSummaryDto>> {
    const scoped: Prisma.AssessmentAttemptWhereInput = {
      ...where,
      ...(query.search
        ? {
            OR: [
              { assessment: { title: { contains: query.search, mode: 'insensitive' } } },
              { student: { user: { firstName: { contains: query.search, mode: 'insensitive' } } } },
              { student: { user: { lastName: { contains: query.search, mode: 'insensitive' } } } },
              { student: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [attempts, totalItems] = await Promise.all([
      this.prisma.assessmentAttempt.findMany({
        where: scoped,
        include: ATTEMPT_SUMMARY_INCLUDE,
        // Oldest submission first in the review queue, newest first elsewhere.
        orderBy:
          query.status === AttemptStatus.SUBMITTED
            ? { submittedAt: 'asc' }
            : { startedAt: query.sortOrder ?? 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.assessmentAttempt.count({ where: scoped }),
    ]);

    return buildPaginatedResult(
      attempts.map((a) => this.toAttemptSummaryDto(a)),
      totalItems,
      query.page,
      query.pageSize,
    );
  }

  private async countAttempts(assessmentIds: string[]): Promise<Map<string, AttemptCounts>> {
    const counts = new Map<string, AttemptCounts>();
    if (assessmentIds.length === 0) {
      return counts;
    }

    const rows = await this.prisma.assessmentAttempt.groupBy({
      by: ['assessmentId', 'status'],
      where: { assessmentId: { in: assessmentIds } },
      _count: { _all: true },
    });

    for (const row of rows) {
      const current = counts.get(row.assessmentId) ?? { attemptCount: 0, awaitingReviewCount: 0 };
      current.attemptCount += row._count._all;
      if (row.status === AttemptStatus.SUBMITTED) {
        current.awaitingReviewCount += row._count._all;
      }
      counts.set(row.assessmentId, current);
    }

    return counts;
  }

  private questionPaperOf(assessment: AssessmentWithRelations): AssessmentFileDto | null {
    const paper = assessment.papers[0];
    return paper ? this.toFileDto(paper) : null;
  }

  private toFileDto(file: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }): AssessmentFileDto {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    };
  }

  private toQuestionDto(
    question: Prisma.AssessmentQuestionGetPayload<{ include: typeof QUESTION_INCLUDE }>,
    revealAnswerKey: boolean,
  ): AssessmentQuestionDto {
    return {
      id: question.id,
      prompt: question.prompt,
      points: question.points,
      orderIndex: question.orderIndex,
      options: question.options.map((o) => ({
        id: o.id,
        text: o.text,
        orderIndex: o.orderIndex,
        ...(revealAnswerKey ? { isCorrect: o.isCorrect } : {}),
      })),
    };
  }

  private toSummaryDto(
    assessment: AssessmentWithRelations,
    counts: AttemptCounts | undefined,
  ): AssessmentSummaryDto {
    return {
      id: assessment.id,
      courseId: assessment.courseId,
      courseTitle: assessment.course.title,
      type: assessment.type,
      title: assessment.title,
      instructions: assessment.instructions,
      passPercent: assessment.passPercent,
      timeLimitMinutes: assessment.timeLimitMinutes,
      status: assessment.status,
      orderIndex: assessment.orderIndex,
      questionCount: assessment.questions.length,
      hasQuestionPaper: assessment.papers.length > 0,
      attemptCount: counts?.attemptCount ?? 0,
      awaitingReviewCount: counts?.awaitingReviewCount ?? 0,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    };
  }

  private toDetailDto(
    assessment: AssessmentWithRelations,
    counts: AttemptCounts | undefined,
  ): AssessmentDetailDto {
    return {
      ...this.toSummaryDto(assessment, counts),
      questions: assessment.questions.map((q) => this.toQuestionDto(q, true)),
      questionPaper: this.questionPaperOf(assessment),
    };
  }

  private toStudentSummaryDto(
    assessment: AssessmentWithRelations,
    myAttempts: { id: string; status: AttemptStatus; scorePercent: number | null; attemptNumber: number }[],
  ): StudentAssessmentSummaryDto {
    const standing = computeAssessmentStanding(myAttempts);

    return {
      id: assessment.id,
      courseId: assessment.courseId,
      courseTitle: assessment.course.title,
      type: assessment.type,
      title: assessment.title,
      instructions: assessment.instructions,
      passPercent: assessment.passPercent,
      timeLimitMinutes: assessment.timeLimitMinutes,
      questionCount: assessment.questions.length,
      myStatus: standing.status,
      bestScorePercent: standing.bestScorePercent,
      attemptsCount: standing.attemptsCount,
      latestAttemptId: standing.latestAttemptId,
      bestAttemptId: standing.bestAttemptId,
    };
  }

  private toAttemptSummaryDto(attempt: AttemptSummarySource): AttemptSummaryDto {
    return {
      id: attempt.id,
      assessmentId: attempt.assessmentId,
      assessmentTitle: attempt.assessment.title,
      assessmentType: attempt.assessment.type,
      courseId: attempt.assessment.courseId,
      courseTitle: attempt.assessment.course.title,
      student: {
        id: attempt.student.id,
        firstName: attempt.student.user.firstName,
        lastName: attempt.student.user.lastName,
        email: attempt.student.user.email,
      },
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      scorePercent: attempt.scorePercent,
      passPercent: attempt.assessment.passPercent,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
    };
  }

  private toAttemptDetailDto(
    attempt: AttemptWithDetail,
    revealAnswerKey: boolean,
  ): AttemptDetailDto {
    const byQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));

    return {
      ...this.toAttemptSummaryDto(attempt),
      feedback: attempt.feedback,
      gradedBy: attempt.gradedBy
        ? {
            id: attempt.gradedBy.id,
            firstName: attempt.gradedBy.firstName,
            lastName: attempt.gradedBy.lastName,
          }
        : null,
      answers: attempt.assessment.questions.map((q) => ({
        questionId: q.id,
        prompt: q.prompt,
        points: q.points,
        chosenOptionId: byQuestion.get(q.id)?.optionId ?? null,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          ...(revealAnswerKey ? { isCorrect: o.isCorrect } : {}),
        })),
      })),
      submissions: attempt.submissions.map((s) => ({
        id: s.id,
        originalName: s.originalName,
        mimeType: s.mimeType,
        sizeBytes: s.sizeBytes,
        createdAt: s.createdAt,
      })),
    };
  }

  /**
   * Same signed-token scheme as `CourseFilesService`: a short-lived JWT the
   * browser can hang off an <iframe>, redeemed by `GET /api/files/stream/:id`.
   */
  /** Delegated so the token scheme has exactly one implementation. */
  private signStreamUrl(userId: string, fileId: string): FileStreamUrlDto {
    return this.streamTokens.sign(userId, fileId);
  }
}
