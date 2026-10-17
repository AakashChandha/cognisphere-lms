-- CreateEnum
CREATE TYPE "CourseProgressionMode" AS ENUM ('FREE', 'SEQUENTIAL');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('LESSON_MATERIAL', 'STUDY_MATERIAL', 'QUESTION_PAPER', 'SUBMISSION', 'COURSE_THUMBNAIL');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('MCQ', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'PASSED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_UNPUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_GRADED';
ALTER TYPE "AuditAction" ADD VALUE 'STUDY_MATERIAL_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'STUDY_MATERIAL_DELETED';

-- AlterTable
ALTER TABLE "course_files" ADD COLUMN     "assessment_id" TEXT,
ADD COLUMN     "attempt_id" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "purpose" "FilePurpose" NOT NULL DEFAULT 'LESSON_MATERIAL',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "progression_mode" "CourseProgressionMode" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "file_views" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "pass_percent" INTEGER NOT NULL DEFAULT 70,
    "time_limit_minutes" INTEGER,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score_percent" INTEGER,
    "feedback" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "graded_at" TIMESTAMP(3),
    "graded_by_id" TEXT,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answers" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_id" TEXT,

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_views_file_id_idx" ON "file_views"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_views_student_id_file_id_key" ON "file_views"("student_id", "file_id");

-- CreateIndex
CREATE INDEX "assessments_course_id_idx" ON "assessments"("course_id");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessment_questions_assessment_id_idx" ON "assessment_questions"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_options_question_id_idx" ON "assessment_options"("question_id");

-- CreateIndex
CREATE INDEX "assessment_attempts_assessment_id_idx" ON "assessment_attempts"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_attempts_student_id_idx" ON "assessment_attempts"("student_id");

-- CreateIndex
CREATE INDEX "assessment_attempts_status_idx" ON "assessment_attempts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_assessment_id_student_id_attempt_number_key" ON "assessment_attempts"("assessment_id", "student_id", "attempt_number");

-- CreateIndex
CREATE INDEX "assessment_answers_question_id_idx" ON "assessment_answers"("question_id");

-- CreateIndex
CREATE INDEX "assessment_answers_option_id_idx" ON "assessment_answers"("option_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answers_attempt_id_question_id_key" ON "assessment_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "course_files_purpose_idx" ON "course_files"("purpose");

-- CreateIndex
CREATE INDEX "course_files_assessment_id_idx" ON "course_files"("assessment_id");

-- CreateIndex
CREATE INDEX "course_files_attempt_id_idx" ON "course_files"("attempt_id");

-- AddForeignKey
ALTER TABLE "course_files" ADD CONSTRAINT "course_files_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_files" ADD CONSTRAINT "course_files_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_views" ADD CONSTRAINT "file_views_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_views" ADD CONSTRAINT "file_views_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "course_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_options" ADD CONSTRAINT "assessment_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "assessment_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
