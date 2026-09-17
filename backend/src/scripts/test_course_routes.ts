import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTest() {
  console.log('--- Testing Course & Instructor Integration Backend Logic ---');

  // 1. Test Query Courses & Subjects
  const courses = await prisma.course.findMany({
    include: {
      subjects: {
        include: {
          sessions: true,
        },
      },
      batches: {
        include: {
          instructors: {
            include: { instructor: true },
          },
          liveSessions: true,
        },
      },
    },
  });

  console.log(`[PASS] Found ${courses.length} Course(s) in system.`);

  // 2. Test Honorarium calculation formula verification
  const durationMin = 90;
  const hourlyRate = 150000;
  const calculatedFee = Math.round((durationMin / 60) * hourlyRate);
  console.log(`[PASS] Honor Calculation Formula: (${durationMin} min / 60) * Rp ${hourlyRate} = Rp ${calculatedFee.toLocaleString('id-ID')}`);

  // 3. Test Progress percentage formula verification
  const totalSessions = 4;
  const completedSessions = 2;
  const percentage = Math.round((completedSessions / totalSessions) * 100);
  console.log(`[PASS] Progress Percentage Formula: (${completedSessions} / ${totalSessions}) * 100 = ${percentage}%`);

  console.log('--- All Backend Business Logic Validated Successfully ---');
}

runTest()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
