-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'QUERY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'QUERY_REPLIED';
ALTER TYPE "AuditAction" ADD VALUE 'QUERY_RESOLVED';

-- CreateTable
CREATE TABLE "course_queries" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "QueryStatus" NOT NULL DEFAULT 'OPEN',
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_query_messages" (
    "id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_query_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_queries_course_id_status_idx" ON "course_queries"("course_id", "status");

-- CreateIndex
CREATE INDEX "course_queries_student_id_status_idx" ON "course_queries"("student_id", "status");

-- CreateIndex
CREATE INDEX "course_queries_last_message_at_idx" ON "course_queries"("last_message_at");

-- CreateIndex
CREATE INDEX "course_query_messages_query_id_created_at_idx" ON "course_query_messages"("query_id", "created_at");

-- AddForeignKey
ALTER TABLE "course_queries" ADD CONSTRAINT "course_queries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_queries" ADD CONSTRAINT "course_queries_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_queries" ADD CONSTRAINT "course_queries_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_query_messages" ADD CONSTRAINT "course_query_messages_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "course_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_query_messages" ADD CONSTRAINT "course_query_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
