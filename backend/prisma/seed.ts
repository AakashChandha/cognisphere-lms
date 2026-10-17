import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

const STORAGE_ROOT = resolve(process.env.STORAGE_LOCAL_ROOT ?? 'storage');

/**
 * Builds a one-page PDF from a few lines of text. The demo assessment needs a
 * real question paper and the demo study material needs a real book extract,
 * and both are streamed straight off disk by the file controllers - so a
 * placeholder string would 404 in the viewer. Writing the bytes here keeps the
 * whole exam flow clickable straight after `prisma db seed`, with no binary
 * fixtures committed to the repo.
 */
function buildPdf(lines: string[]): Buffer {
  const escape = (line: string) => line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content =
    'BT\n/F1 13 Tf\n18 TL\n60 780 Td\n' +
    lines.map((line) => `(${escape(line)}) Tj T*`).join('\n') +
    '\nET\n';

  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${Buffer.byteLength(content, 'latin1')}>>\nstream\n${content}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

/** Writes a generated PDF into the storage root the same way an upload would. */
async function storePdf(folder: string, lines: string[]): Promise<{ storageKey: string; sizeBytes: number }> {
  const bytes = buildPdf(lines);
  await fs.mkdir(join(STORAGE_ROOT, folder), { recursive: true });
  const storageKey = `${folder}/${randomUUID()}.pdf`;
  await fs.writeFile(join(STORAGE_ROOT, storageKey), bytes);
  return { storageKey, sizeBytes: bytes.length };
}

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
        // The seeded password comes from .env; in production force a real one at first sign-in.
        mustChangePassword: process.env.NODE_ENV === 'production',
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        userRoles: { create: [{ roleId: masterRole.id }] },
      },
    });
  } else {
    console.log('Master account already exists, skipping.');
  }

  // Demo tutor/student/course data is for local development only. Their
  // passwords are documented in the README, so they must never exist on a
  // public deployment. The production `migrate` job runs with
  // NODE_ENV=production and therefore only seeds roles + the master account.
  if (process.env.NODE_ENV === 'production') {
    console.log('Production environment: skipping demo accounts and demo course.');
    console.log('Seed complete.');
    return;
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

  await seedNeboshDemoCourse();
  await seedDemoQueries();

  console.log('Seed complete.');
}

/**
 * A second demo course that exercises the features the first one cannot: an
 * unskippable (SEQUENTIAL) progression, an auto-graded MCQ assessment and a
 * document assessment with a real question paper, plus an external study
 * material. Keyed on the course slug so re-seeding is a no-op.
 */
async function seedNeboshDemoCourse(): Promise<void> {
  const slug = 'nebosh-igc-managing-health-and-safety';
  if (await prisma.course.findUnique({ where: { slug } })) {
    console.log('NEBOSH demo course already exists, skipping.');
    return;
  }

  const tutorUser = await prisma.user.findUnique({
    where: { email: 'tutor.demo@cgslms.local' },
    include: { tutor: true },
  });
  const studentUser = await prisma.user.findUnique({
    where: { email: 'student.demo@cgslms.local' },
    include: { student: true },
  });

  if (!tutorUser?.tutor) {
    console.log('No demo tutor, skipping the NEBOSH demo course.');
    return;
  }

  console.log('Creating the NEBOSH demo course (unskippable, with assessments)...');

  const course = await prisma.course.create({
    data: {
      tutorId: tutorUser.tutor.id,
      title: 'NEBOSH IGC: Managing Health and Safety',
      slug,
      description:
        'Element 1 of the NEBOSH International General Certificate. Covers why health and safety is managed, the moral, legal and financial arguments, and the role of a health and safety management system.',
      status: 'PUBLISHED',
      progressionMode: 'SEQUENTIAL',
      publishedAt: new Date(),
      lessons: {
        create: [
          {
            orderIndex: 0,
            title: 'Why we manage health and safety',
            content:
              '## The three arguments\n\nEvery health and safety case rests on three legs: the **moral** duty not to harm people at work, the **legal** duty imposed by statute, and the **financial** cost of getting it wrong.\n\nWork through this lesson before moving on - this course is set to unskippable, so the next lesson unlocks once you have reached the end of everything here.',
          },
          {
            orderIndex: 1,
            title: 'The cost of accidents and ill health',
            content:
              '## Direct and indirect costs\n\nDirect costs are the ones that show up on an invoice: sick pay, repairs, fines, increased insurance premiums.\n\nIndirect costs are larger and harder to see: lost production, retraining, investigation time, low morale and reputational damage. The usual rule of thumb is that indirect costs run several times the direct ones.',
          },
          {
            orderIndex: 2,
            title: 'Health and safety management systems',
            content:
              '## Plan, Do, Check, Act\n\nISO 45001 and HSG65 both describe a cycle rather than a one-off exercise:\n\n1. **Plan** - set policy and objectives.\n2. **Do** - organise, assess risk and implement controls.\n3. **Check** - measure performance, actively and reactively.\n4. **Act** - review and improve.',
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

  // --- Auto-graded MCQ assessment -----------------------------------------
  const mcq = await prisma.assessment.create({
    data: {
      courseId: course.id,
      type: 'MCQ',
      title: 'Element 1 knowledge check',
      instructions:
        'Ten minutes, four questions. You need 70% to pass and you can retake this as many times as you like - your best score is the one that counts.',
      passPercent: 70,
      timeLimitMinutes: 10,
      status: 'PUBLISHED',
      orderIndex: 0,
    },
  });

  const questions: { prompt: string; options: [string, boolean][] }[] = [
    {
      prompt: 'Which of these is the moral argument for managing health and safety?',
      options: [
        ['People should not be harmed by the work they do', true],
        ['Insurance premiums rise after a claim', false],
        ['The regulator can issue an improvement notice', false],
        ['Accidents interrupt production schedules', false],
      ],
    },
    {
      prompt: 'Indirect costs of an accident are best described as...',
      options: [
        ['Costs recoverable in full from the insurer', false],
        ['Uninsured losses such as lost production, investigation time and retraining', true],
        ['The fine imposed by a court', false],
        ['The cost of repairing damaged equipment', false],
      ],
    },
    {
      prompt: 'What do the four stages of HSG65 stand for?',
      options: [
        ['Prepare, Deliver, Confirm, Audit', false],
        ['Plan, Do, Check, Act', true],
        ['Policy, Duty, Control, Assurance', false],
        ['Prevent, Detect, Correct, Assess', false],
      ],
    },
    {
      prompt: 'Active (leading) monitoring is best described as...',
      options: [
        ['Investigating accidents after they happen', false],
        ['Counting lost-time injuries each quarter', false],
        ['Checking that controls are working before anyone is harmed', true],
        ['Reviewing insurance claims at year end', false],
      ],
    },
  ];

  for (const [index, question] of questions.entries()) {
    await prisma.assessmentQuestion.create({
      data: {
        assessmentId: mcq.id,
        prompt: question.prompt,
        points: 1,
        orderIndex: index,
        options: {
          create: question.options.map(([text, isCorrect], optionIndex) => ({
            text,
            isCorrect,
            orderIndex: optionIndex,
          })),
        },
      },
    });
  }

  // --- Document assessment, with a real question paper on disk -------------
  const paperAssessment = await prisma.assessment.create({
    data: {
      courseId: course.id,
      type: 'DOCUMENT',
      title: 'Unit IG2 risk assessment (practical)',
      instructions:
        'Open the question paper, carry out a risk assessment of your own workplace on the template it contains, and upload the completed document as a PDF. Your tutor will review it and return a pass or fail with written feedback.',
      passPercent: 60,
      status: 'PUBLISHED',
      orderIndex: 1,
    },
  });

  const paper = await storePdf(`courses/${course.id}`, [
    'NEBOSH International General Certificate',
    'Unit IG2 - Risk assessment (practical application)',
    '',
    'Instructions to candidates',
    '',
    '1. Choose a workplace you know well.',
    '2. Describe the organisation, its activities and the number of workers.',
    '3. Identify at least ten hazards across a minimum of five hazard categories.',
    '4. For each hazard, record who might be harmed and how.',
    '5. Evaluate the risk and record the controls already in place.',
    '6. Recommend further controls, with a justification and a timescale.',
    '7. Review the assessment and state when it will next be revisited.',
    '',
    'Submit your completed assessment as a single PDF.',
    'This is a demonstration paper generated by the development seed.',
  ]);

  await prisma.courseFile.create({
    data: {
      courseId: course.id,
      uploadedById: tutorUser.id,
      assessmentId: paperAssessment.id,
      purpose: 'QUESTION_PAPER',
      originalName: 'IG2-risk-assessment-question-paper.pdf',
      storageKey: paper.storageKey,
      mimeType: 'application/pdf',
      sizeBytes: paper.sizeBytes,
    },
  });

  // --- External study material --------------------------------------------
  const book = await storePdf(`courses/${course.id}`, [
    'Managing for health and safety (HSG65) - extract',
    '',
    'Plan',
    '  Decide what you want to achieve, who is responsible for what,',
    '  how you will achieve your aims and how you will measure success.',
    '',
    'Do',
    '  Identify your risk profile, organise your activities to deliver',
    '  your plan, and implement your plan with the right people and controls.',
    '',
    'Check',
    '  Measure performance against the plan. Investigate the causes of',
    '  accidents, incidents and near misses.',
    '',
    'Act',
    '  Review performance and act on lessons learned.',
    '',
    'This is a demonstration extract generated by the development seed.',
  ]);

  await prisma.courseFile.create({
    data: {
      courseId: course.id,
      uploadedById: tutorUser.id,
      purpose: 'STUDY_MATERIAL',
      title: 'Managing for health and safety (HSG65) - extract',
      description: 'The Plan-Do-Check-Act cycle in the regulator\'s own words. Background reading for Element 1.',
      originalName: 'hsg65-extract.pdf',
      storageKey: book.storageKey,
      mimeType: 'application/pdf',
      sizeBytes: book.sizeBytes,
    },
  });
}

/**
 * Three query threads on the demo course, one in each state, so the student and
 * tutor inboxes are not empty on a fresh seed. Skipped if any query exists.
 */
async function seedDemoQueries(): Promise<void> {
  if ((await prisma.courseQuery.count()) > 0) {
    console.log('Queries already exist, skipping.');
    return;
  }

  const course = await prisma.course.findUnique({
    where: { slug: 'nebosh-igc-managing-health-and-safety' },
    include: { lessons: { orderBy: { orderIndex: 'asc' } }, tutor: { include: { user: true } } },
  });
  const studentUser = await prisma.user.findUnique({
    where: { email: 'student.demo@cgslms.local' },
    include: { student: true },
  });

  if (!course?.tutor || !studentUser?.student) {
    console.log('No demo course or student, skipping queries.');
    return;
  }

  console.log('Creating demo query threads...');

  const studentId = studentUser.student.id;
  const studentUserId = studentUser.id;
  const tutorUserId = course.tutor.user.id;
  const [lesson1, lesson2] = course.lessons;
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

  // Waiting on the tutor.
  await prisma.courseQuery.create({
    data: {
      studentId,
      courseId: course.id,
      lessonId: lesson2?.id ?? null,
      title: 'How do I work out the indirect costs of an accident?',
      status: 'OPEN',
      createdAt: minutesAgo(45),
      lastMessageAt: minutesAgo(45),
      messages: {
        create: [
          {
            authorId: studentUserId,
            body: "In the lesson on the cost of accidents, the insured costs make sense to me, but I am not sure how far the indirect costs are meant to go. Would lost production time and the cost of retraining a replacement both count? Is there a rule of thumb for the ratio?",
            createdAt: minutesAgo(45),
          },
        ],
      },
    },
  });

  // Tutor replied; waiting on the student.
  await prisma.courseQuery.create({
    data: {
      studentId,
      courseId: course.id,
      lessonId: lesson1?.id ?? null,
      title: 'Moral vs legal arguments - are they ever the same thing?',
      status: 'ANSWERED',
      createdAt: minutesAgo(300),
      lastMessageAt: minutesAgo(180),
      messages: {
        create: [
          {
            authorId: studentUserId,
            body: 'The three arguments for managing health and safety are clear separately, but in the exam how do I avoid giving the same point twice when the moral and legal arguments overlap?',
            createdAt: minutesAgo(300),
          },
          {
            authorId: tutorUserId,
            body: 'Good question, and a common trap. Keep the test in mind: the moral argument is about why harm is unacceptable in itself, the legal one is about the duty and the consequence of breaching it. "People should not be hurt at work" is moral. "Breaching the duty risks prosecution and an unlimited fine" is legal. Same scenario, different reason - write the reason, not the scenario.',
            createdAt: minutesAgo(180),
          },
        ],
      },
    },
  });

  // Closed by the student.
  await prisma.courseQuery.create({
    data: {
      studentId,
      courseId: course.id,
      lessonId: null,
      title: 'Can I retake the knowledge check if I fail it?',
      status: 'RESOLVED',
      createdAt: minutesAgo(1500),
      lastMessageAt: minutesAgo(1400),
      resolvedAt: minutesAgo(1380),
      messages: {
        create: [
          {
            authorId: studentUserId,
            body: 'If I do not reach the pass mark on the Element 1 knowledge check, do I get another go, and does the lower score stay against me?',
            createdAt: minutesAgo(1500),
          },
          {
            authorId: tutorUserId,
            body: 'Yes - retake it as many times as you need. Your best score is the one that counts, so a low first attempt does you no harm. Once you have passed, that is final and the assessment closes.',
            createdAt: minutesAgo(1400),
          },
        ],
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
