import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Course & Instructor Integration Module ---');

  // 1. Ambil atau Buat User Tutor & Siswa untuk Testing
  let tutor = await prisma.user.findFirst({ where: { username: 'tutor_fermat' } });
  if (!tutor) {
    tutor = await prisma.user.create({
      data: {
        name: 'Dr. Fermat (Master Tutor Matematika & TPS)',
        username: 'tutor_fermat',
        passwordHash: 'dummy_hash',
        role: 'Tutor',
        permissions: JSON.stringify(['courses', 'live_sessions', 'reviews']),
      },
    });
    console.log('Created Tutor User:', tutor.name);
  }

  let student = await prisma.user.findFirst({ where: { username: 'siswa_utbk' } });
  if (!student) {
    student = await prisma.user.create({
      data: {
        name: 'Andi Pratama (Siswa Batch 1)',
        username: 'siswa_utbk',
        passwordHash: 'dummy_hash',
        role: 'Siswa',
        permissions: JSON.stringify(['student_portal']),
      },
    });
    console.log('Created Student User:', student.name);
  }

  // 2. Buat Course
  const course = await prisma.course.upsert({
    where: { code: 'SNBT-2027-INTENSIF' },
    update: {},
    create: {
      code: 'SNBT-2027-INTENSIF',
      title: 'Program Intensif UTBK SNBT 2027 (TPS & Literasi)',
      category: 'BIMBEL',
      description: 'Program persiapan tembus PTN Favorit dengan metode Adaptive CBT dan Pembahasan Mendalam.',
      price: 1500000,
      status: 'ACTIVE',
    },
  });
  console.log('Course Upserted:', course.title);

  // 3. Buat Mata Pelajaran (CourseSubject)
  let subject = await prisma.courseSubject.findFirst({
    where: { courseId: course.id, name: 'Pengetahuan Kuantitatif & Matematika Dasar' },
  });
  if (!subject) {
    subject = await prisma.courseSubject.create({
      data: {
        courseId: course.id,
        name: 'Pengetahuan Kuantitatif & Matematika Dasar',
        description: 'Materi Aljabar, Peluang, Geometri & Aritmetika Cepat',
        orderIndex: 1,
      },
    });
    console.log('Created Subject:', subject.name);
  }

  // 4. Buat Sesi Materi Belajar (CourseSession)
  let session1 = await prisma.courseSession.findFirst({
    where: { subjectId: subject.id, title: 'Sesi 01: Trik 10 Detik Aljabar & Fungsi' },
  });
  if (!session1) {
    session1 = await prisma.courseSession.create({
      data: {
        subjectId: subject.id,
        title: 'Sesi 01: Trik 10 Detik Aljabar & Fungsi',
        description: 'Pembahasan konsep dasar fungsi komposisi dan substitusi cerdas tanpa rumus panjang.',
        orderIndex: 1,
        handoutPdfUrl: 'https://example.com/handouts/aljabar_sesi_1.pdf',
        vodVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        vodDurationSec: 3600,
        quizUrl: 'https://cbt.fermatacademy.com/exam/aljabar-01',
        minPassingScore: 70,
      },
    });
    console.log('Created Session 1:', session1.title);
  }

  // 5. Buat Batch / Cohort Angkatan
  let batch = await prisma.courseBatch.findFirst({
    where: { courseId: course.id, name: 'Batch 1 - Gelombang Oktober 2026' },
  });
  if (!batch) {
    batch = await prisma.courseBatch.create({
      data: {
        courseId: course.id,
        name: 'Batch 1 - Gelombang Oktober 2026',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-11-30'),
        maxStudents: 50,
        status: 'OPEN',
      },
    });
    console.log('Created Batch:', batch.name);
  }

  // 6. Tugaskan Tutor ke Batch (BatchInstructor)
  let instructorAssignment = await prisma.batchInstructor.findUnique({
    where: {
      batchId_instructorId: {
        batchId: batch.id,
        instructorId: tutor.id,
      },
    },
  });
  if (!instructorAssignment) {
    instructorAssignment = await prisma.batchInstructor.create({
      data: {
        batchId: batch.id,
        instructorId: tutor.id,
        role: 'LEAD_INSTRUCTOR',
        hourlyRate: 150000, // Rp 150.000 / jam
      },
    });
    console.log('Assigned Tutor to Batch with Rate:', instructorAssignment.hourlyRate);
  }

  // 7. Buat Jadwal Live Class (BatchLiveSession)
  let liveSession = await prisma.batchLiveSession.findFirst({
    where: { batchId: batch.id, sessionId: session1.id },
  });
  if (!liveSession) {
    liveSession = await prisma.batchLiveSession.create({
      data: {
        batchId: batch.id,
        sessionId: session1.id,
        instructorId: tutor.id,
        scheduledAt: new Date(Date.now() + 86400000), // Besok
        durationMin: 90,
        meetingUrl: 'https://zoom.us/j/9876543210',
        meetingPass: 'FERMAT2026',
        status: 'SCHEDULED',
      },
    });
    console.log('Created Live Session Schedule:', liveSession.scheduledAt);
  }

  // 8. Catat Progres Siswa
  let progress = await prisma.studentSessionProgress.findUnique({
    where: {
      studentId_sessionId: {
        studentId: student.id,
        sessionId: session1.id,
      },
    },
  });
  if (!progress) {
    progress = await prisma.studentSessionProgress.create({
      data: {
        studentId: student.id,
        sessionId: session1.id,
        isPdfRead: true,
        isVideoDone: true,
        quizScore: 85,
        isCompleted: true,
        completedAt: new Date(),
      },
    });
    console.log('Created Student Progress (100% Completed, Score 85):', progress.isCompleted);
  }

  console.log('✅ Seeding Phase 1 Complete Successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
