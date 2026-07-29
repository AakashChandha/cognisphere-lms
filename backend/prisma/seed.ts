import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

async function main(): Promise<void> {
  console.log('Seeding roles...');
  await Promise.all(
    Object.values(RoleName).map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  const masterEmail = process.env.MASTER_SEED_EMAIL ?? 'master@cgslms.local';
  const masterPassword = process.env.MASTER_SEED_PASSWORD ?? 'Master@12345';

  const existingMaster = await prisma.user.findUnique({ where: { email: masterEmail } });

  if (!existingMaster) {
    console.log(`Creating default Master account: ${masterEmail}`);
    const passwordHash = await bcrypt.hash(masterPassword, BCRYPT_SALT_ROUNDS);
    const masterRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.MASTER } });

    await prisma.user.create({
      data: {
        email: masterEmail,
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        userRoles: { create: [{ roleId: masterRole.id }] },
      },
    });
  } else {
    console.log('Master account already exists, skipping.');
  }

  const demoTutorEmail = 'tutor.demo@cgslms.local';
  let tutorUser = await prisma.user.findUnique({ where: { email: demoTutorEmail }, include: { tutor: true } });

  if (!tutorUser) {
    console.log(`Creating demo tutor account: ${demoTutorEmail}`);
    const tutorRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.TUTOR } });
    const passwordHash = await bcrypt.hash('Tutor@12345', BCRYPT_SALT_ROUNDS);

    tutorUser = await prisma.user.create({
      data: {
        email: demoTutorEmail,
        passwordHash,
        firstName: 'Taylor',
        lastName: 'Tutor',
        userRoles: { create: [{ roleId: tutorRole.id }] },
        tutor: { create: { expertise: 'Web Development' } },
      },
      include: { tutor: true },
    });
  }

  const demoStudentEmail = 'student.demo@cgslms.local';
  let studentUser = await prisma.user.findUnique({
    where: { email: demoStudentEmail },
    include: { student: true },
  });

  if (!studentUser) {
    console.log(`Creating demo student account: ${demoStudentEmail}`);
    const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.STUDENT } });
    const passwordHash = await bcrypt.hash('Student@12345', BCRYPT_SALT_ROUNDS);

    studentUser = await prisma.user.create({
      data: {
        email: demoStudentEmail,
        passwordHash,
        firstName: 'Sam',
        lastName: 'Student',
        userRoles: { create: [{ roleId: studentRole.id }] },
        student: { create: {} },
      },
      include: { student: true },
    });
  }

  if (tutorUser?.tutor) {
    const existingCourse = await prisma.course.findUnique({ where: { slug: 'intro-to-web-development' } });

    if (!existingCourse) {
      console.log('Creating demo published course with a lesson...');
      const course = await prisma.course.create({
        data: {
          tutorId: tutorUser.tutor.id,
          title: 'Introduction to Web Development',
          slug: 'intro-to-web-development',
          description:
            'A beginner-friendly course covering HTML, CSS and JavaScript fundamentals for building modern websites.',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          lessons: {
            create: [
              {
                title: 'Welcome and Course Overview',
                content: 'Welcome to the course! In this lesson we outline what you will learn.',
                orderIndex: 0,
              },
            ],
          },
        },
      });

      if (studentUser?.student) {
        await prisma.enrollment.create({
          data: { studentId: studentUser.student.id, courseId: course.id },
        });
      }

      await prisma.announcement.create({
        data: {
          title: 'Welcome to CGS LMS',
          content: 'We are excited to have you here. Explore your courses and reach out with questions.',
          audience: 'ALL',
          authorId: tutorUser.id,
        },
      });
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
