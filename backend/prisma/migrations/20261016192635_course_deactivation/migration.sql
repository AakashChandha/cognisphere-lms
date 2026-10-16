-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'COURSE_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'COURSE_REACTIVATED';

-- AlterEnum
ALTER TYPE "CourseStatus" ADD VALUE 'DEACTIVATED';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivation_reason" TEXT;
