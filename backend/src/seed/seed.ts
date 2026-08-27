import 'dotenv/config';
import type { InvoiceStatus, Prisma } from '@prisma/client';
import { asStringList } from '../lib/lists.js';
import { prisma } from '../config/db.js';
import { DEFAULT_DEPARTMENTS, DEFAULT_MODULES } from '../lib/tenant.js';
import { DEFAULT_PLANS } from '../lib/billing.js';
import { DEFAULT_THEME } from '../lib/theme.js';
import { hashPassword } from '../middleware/auth.js';
import { seedOrgUnits } from '../lib/schemes.js';
import { dayStamp, jsToWeekday, newQrToken, QR_TTL_MS } from '../lib/teaching.js';
import { defaultAdmissionForm } from '../lib/admissionForm.js';
import { careers, courses, faculty, news } from './content.js';

const run = async () => {
  try {
    await prisma.$connect();
  } catch (err) {
    console.error('Aborting seed — database is not connected. Check DATABASE_URL (PostgreSQL).');
    console.error((err as Error).message);
    process.exit(1);
  }

  try {
    const legacyHr = await prisma.department.findUnique({ where: { slug: 'workforce' } });
    if (legacyHr) {
      const nextHr = await prisma.department.findUnique({ where: { slug: 'human-resources' } });
      if (!nextHr) {
        await prisma.department.update({
          where: { id: legacyHr.id },
          data: {
            slug: 'human-resources',
            name: 'HR',
            description: 'Recruitment, job openings, and the public careers page.',
          },
        });
      } else {
        await prisma.module.updateMany({ where: { departmentId: legacyHr.id }, data: { departmentId: nextHr.id } });
        await prisma.department.delete({ where: { id: legacyHr.id } });
      }
    }
    const orgs = await prisma.organization.findMany({ select: { id: true, departments: true } });
    for (const org of orgs) {
      const departments = asStringList(org.departments);
      if (!departments.includes('workforce')) continue;
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          departments: [...new Set(departments.map((slug) => (slug === 'workforce' ? 'human-resources' : slug)))],
        },
      });
    }

    for (const dept of DEFAULT_DEPARTMENTS) {
      await prisma.department.upsert({
        where: { slug: dept.slug },
        update: { name: dept.name, description: dept.description, sortOrder: dept.sortOrder },
        create: dept,
      });
    }
    const departmentBySlug = Object.fromEntries(
      (await prisma.department.findMany()).map((item) => [item.slug, item.id])
    );
    for (const item of DEFAULT_MODULES) {
      const { departmentSlug, ...data } = item;
      await prisma.module.upsert({
        where: { slug: data.slug },
        update: { ...data, departmentId: departmentBySlug[departmentSlug] || null },
        create: { ...data, departmentId: departmentBySlug[departmentSlug] || null },
      });
    }
    await prisma.module.deleteMany({ where: { slug: 'audit' } });
    const liveModules = await prisma.module.findMany({ where: { active: true }, include: { department: true } });
    const moduleSlugs = liveModules.map((item) => item.slug);
    const departmentSlugs = [...new Set(liveModules.map((item) => item.department?.slug).filter(Boolean))] as string[];
    const productModules = [
      'admissions',
      'interviews',
      'careers',
      'faculty',
      'student-attendance',
      'staff-attendance',
    ];
    console.log(`Departments ready: ${departmentSlugs.join(', ')}`);
    console.log(`Modules ready: ${moduleSlugs.join(', ')}`);

    let explore = await prisma.organization.findUnique({ where: { slug: 'explore' } });
    if (!explore) {
      explore = await prisma.organization.create({
        data: {
          name: 'Explore College of Nursing and Allied Health Sciences',
          slug: 'explore',
          title: 'Explore',
          tagline: 'Nursing & Allied Health',
          logo: '/images/explore/logo.png',
          email: 'hello@explorecollege.org',
          status: 'active',
          modules: productModules,
          departments: departmentSlugs,
          isPublic: true,
          kind: 'education',
          theme: DEFAULT_THEME,
        },
      });
      console.log('Organisation created: explore');
    } else {
      explore = await prisma.organization.update({
        where: { id: explore.id },
        data: {
          modules: productModules,
          departments: departmentSlugs,
          isPublic: true,
          status: 'active',
          kind: 'education',
          ...(!explore.logo
            ? { logo: '/images/explore/logo.png', title: explore.title || 'Explore', tagline: explore.tagline || 'Nursing & Allied Health' }
            : {}),
        },
      });
      console.log('Organisation updated: explore');
    }

    await seedOrgUnits(explore.id, 'education');

    await prisma.faculty.deleteMany({ where: { organizationId: explore.id } });
    await prisma.course.deleteMany({ where: { organizationId: explore.id } });
    await prisma.news.deleteMany({ where: { organizationId: explore.id } });
    await prisma.faculty.createMany({ data: faculty.map((item) => ({ ...item, organizationId: explore.id })) });
    await prisma.course.createMany({ data: courses.map((item) => ({ ...item, organizationId: explore.id })) });
    await prisma.news.createMany({ data: news.map((item) => ({ ...item, organizationId: explore.id })) });

    if ((await prisma.career.count({ where: { organizationId: explore.id } })) === 0) {
      await prisma.career.createMany({ data: careers.map((item) => ({ ...item, organizationId: explore.id })) });
      console.log('Career openings seeded.');
    }

    if ((await prisma.attendancePerson.count({ where: { organizationId: explore.id } })) === 0) {
      const students = [
        { name: 'Ayesha Malik', title: 'Generic Nursing (BSN)', email: 'ayesha.malik@student.explorecollege.org' },
        { name: 'Hassan Raza', title: 'Generic Nursing (BSN)', email: 'hassan.raza@student.explorecollege.org' },
        { name: 'Sana Iqbal', title: 'Post-RN BSN', email: 'sana.iqbal@student.explorecollege.org' },
        { name: 'Bilal Ahmed', title: 'Midwifery', email: 'bilal.ahmed@student.explorecollege.org' },
      ];
      const staff = [
        { name: 'Nazia Shaukat', title: 'Faculty', email: 'nazia.shaukat@explorecollege.org' },
        { name: 'Imran Qureshi', title: 'Accountant', email: 'imran.qureshi@explorecollege.org' },
        { name: 'Farah Siddiqui', title: 'Clerk', email: 'farah.siddiqui@explorecollege.org' },
        { name: 'Tariq Mehmood', title: 'Administrator', email: 'tariq.mehmood@explorecollege.org' },
      ];
      await prisma.attendancePerson.createMany({
        data: [
          ...students.map((item) => ({ ...item, kind: 'student' as const, organizationId: explore.id })),
          ...staff.map((item) => ({ ...item, kind: 'staff' as const, organizationId: explore.id })),
        ],
      });
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const roster = await prisma.attendancePerson.findMany({ where: { organizationId: explore.id } });
      await prisma.attendanceRecord.createMany({
        data: roster.map((person, index) => ({
          organizationId: explore.id,
          personId: person.id,
          date: today,
          status: index === 3 ? 'leave' : index === 2 ? 'late' : 'present',
        })),
      });
      console.log('Attendance roster seeded.');
    }

    await prisma.setting.upsert({
      where: { organizationId: explore.id },
      update: {
        attendanceLocationEnabled: true,
        campusLatitude: 31.5497,
        campusLongitude: 74.3436,
        campusRadiusMeters: 250,
        admissionForm: JSON.stringify(defaultAdmissionForm()),
      },
      create: {
        organizationId: explore.id,
        admissionsOpen: true,
        attendanceLocationEnabled: true,
        campusLatitude: 31.5497,
        campusLongitude: 74.3436,
        campusRadiusMeters: 250,
        admissionForm: JSON.stringify(defaultAdmissionForm()),
      },
    });

    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '';
    if (adminEmail && adminPassword.length >= 6) {
      const password = await hashPassword(adminPassword);
      const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (!existing) {
        await prisma.user.create({
          data: {
            name: 'Explore Administrator',
            email: adminEmail,
            password,
            role: 'admin',
            organizationId: explore.id,
          },
        });
        console.log(`Organisation admin created: ${adminEmail} (sign in at /org-admin)`);
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'admin', password, organizationId: explore.id },
        });
        console.log(`Organisation admin updated: ${adminEmail} (sign in at /org-admin)`);
      }
    } else {
      console.log('Skipping organisation admin seed — set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env');
    }

    if (adminPassword.length >= 6) {
      const teacherEmail = 'faculty@explorecollege.org';
      const teacherPassword = await hashPassword(adminPassword);
      let teacher = await prisma.user.findUnique({ where: { email: teacherEmail } });
      if (!teacher) {
        teacher = await prisma.user.create({
          data: {
            name: 'Nazia Shaukat',
            email: teacherEmail,
            password: teacherPassword,
            role: 'teacher',
            organizationId: explore.id,
          },
        });
        console.log(`Faculty member created: ${teacherEmail} (sign in at /faculty-portal)`);
      } else if (teacher.role === 'teacher' || teacher.role === 'reader' || teacher.role === 'officer') {
        teacher = await prisma.user.update({
          where: { id: teacher.id },
          data: { role: 'teacher', password: teacherPassword, organizationId: explore.id, name: teacher.name || 'Nazia Shaukat' },
        });
        console.log(`Faculty member updated: ${teacherEmail} (sign in at /faculty-portal)`);
      }

      const officerEmail = 'officer@explorecollege.org';
      const existingOfficer = await prisma.user.findUnique({ where: { email: officerEmail } });
      if (!existingOfficer) {
        await prisma.user.create({
          data: {
            name: 'Admissions Officer',
            email: officerEmail,
            password: teacherPassword,
            role: 'officer',
            organizationId: explore.id,
          },
        });
        console.log(`Admissions officer created: ${officerEmail} (sign in at /faculty-portal)`);
      } else {
        await prisma.user.update({
          where: { id: existingOfficer.id },
          data: { role: 'officer', password: teacherPassword, organizationId: explore.id },
        });
        console.log(`Admissions officer updated: ${officerEmail} (sign in at /faculty-portal)`);
      }

      const programmes = await prisma.course.findMany({ where: { organizationId: explore.id } });
      const bsn = programmes.find((item) => item.title.includes('Generic Nursing'));
      const postRn = programmes.find((item) => item.title.includes('Post RN') || item.title.includes('Post-RN'));
      const students = await prisma.attendancePerson.findMany({
        where: { organizationId: explore.id, kind: 'student' },
        orderBy: { name: 'asc' },
      });

      if (teacher && (await prisma.classSection.count({ where: { organizationId: explore.id } })) === 0) {
        const bsnClass = await prisma.classSection.create({
          data: {
            organizationId: explore.id,
            courseId: bsn?.id || null,
            teacherId: teacher.id,
            name: 'Generic Nursing · Year 1',
            code: 'BSN-Y1',
            room: 'Room 101',
          },
        });
        const postClass = await prisma.classSection.create({
          data: {
            organizationId: explore.id,
            courseId: postRn?.id || null,
            teacherId: teacher.id,
            name: 'Post-RN BSN · Section A',
            code: 'PRN-A',
            room: 'Room 102',
          },
        });
        const bsnStudents = students.filter((item) => item.title.includes('Generic Nursing'));
        const postStudents = students.filter((item) => !item.title.includes('Generic Nursing'));
        await prisma.classEnrollment.createMany({
          data: [
            ...bsnStudents.map((person) => ({ classId: bsnClass.id, personId: person.id })),
            ...postStudents.map((person) => ({ classId: postClass.id, personId: person.id })),
          ],
        });
        await prisma.timetableSlot.createMany({
          data: [
            { organizationId: explore.id, classId: bsnClass.id, teacherId: teacher.id, dayOfWeek: 1, startTime: '09:00', endTime: '10:30', room: 'Room 101' },
            { organizationId: explore.id, classId: postClass.id, teacherId: teacher.id, dayOfWeek: 1, startTime: '11:00', endTime: '12:30', room: 'Room 102' },
            { organizationId: explore.id, classId: bsnClass.id, teacherId: teacher.id, dayOfWeek: 3, startTime: '09:00', endTime: '10:30', room: 'Room 101' },
            { organizationId: explore.id, classId: postClass.id, teacherId: teacher.id, dayOfWeek: 4, startTime: '11:00', endTime: '12:30', room: 'Room 102' },
            { organizationId: explore.id, classId: bsnClass.id, teacherId: teacher.id, dayOfWeek: 5, startTime: '09:00', endTime: '10:30', room: 'Skills lab' },
          ],
        });
        await ensureTodaySlots(explore.id, teacher.id, bsnClass.id, postClass.id);
        await prisma.courseContent.createMany({
          data: [
            {
              organizationId: explore.id,
              classId: bsnClass.id,
              teacherId: teacher.id,
              week: 1,
              title: 'Foundations of nursing practice',
              body: 'Introduction to professional nursing, patient safety, and the skills lab sequence for Year 1.',
            },
            {
              organizationId: explore.id,
              classId: postClass.id,
              teacherId: teacher.id,
              week: 1,
              title: 'Leadership in clinical settings',
              body: 'Bridging diploma practice into bachelor-level leadership, documentation, and ward management.',
            },
          ],
        });
        console.log('Teaching classes, timetable, and course content seeded.');
      } else if (teacher) {
        await prisma.classSection.updateMany({
          where: { organizationId: explore.id, code: 'BSN-Y1' },
          data: { courseId: bsn?.id || null, teacherId: teacher.id },
        });
        await prisma.classSection.updateMany({
          where: { organizationId: explore.id, code: 'PRN-A' },
          data: { courseId: postRn?.id || null, teacherId: teacher.id },
        });
        const bsnClass = await prisma.classSection.findFirst({ where: { organizationId: explore.id, code: 'BSN-Y1' } });
        const postClass = await prisma.classSection.findFirst({ where: { organizationId: explore.id, code: 'PRN-A' } });
        if (bsnClass && postClass) {
          await ensureTodaySlots(explore.id, teacher.id, bsnClass.id, postClass.id);
        }
      }
    }

    await ensureDemoStudent(explore.id);

    const platformEmail = (process.env.PLATFORM_EMAIL || 'platform@explore.app').trim().toLowerCase();
    const platformPassword = process.env.PLATFORM_PASSWORD || adminPassword;
    if (platformEmail && platformPassword.length >= 6 && platformEmail !== adminEmail) {
      const password = await hashPassword(platformPassword);
      const existing = await prisma.user.findUnique({ where: { email: platformEmail } });
      if (!existing) {
        await prisma.user.create({
          data: {
            name: 'Platform Super Admin',
            email: platformEmail,
            password,
            role: 'superadmin',
            organizationId: null,
          },
        });
        console.log(`Super admin created: ${platformEmail} (sign in at /x7k2m9q4p8n3)`);
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'superadmin', password, organizationId: null },
        });
        console.log(`Super admin updated: ${platformEmail} (sign in at /x7k2m9q4p8n3)`);
      }
    } else if (platformEmail === adminEmail) {
      console.log('PLATFORM_EMAIL matches ADMIN_EMAIL — set a distinct PLATFORM_EMAIL for the super admin.');
    } else {
      console.log('Skipping super admin seed — set PLATFORM_EMAIL and PLATFORM_PASSWORD in backend/.env');
    }

    for (const plan of DEFAULT_PLANS) {
      await prisma.plan.upsert({
        where: { slug: plan.slug },
        update: plan,
        create: { ...plan, currency: 'USD' },
      });
    }
    const campusPlan = await prisma.plan.findUnique({ where: { slug: 'campus' } });
    if (campusPlan && (await prisma.subscription.count({ where: { organizationId: explore.id } })) === 0) {
      const startedAt = new Date();
      startedAt.setUTCMonth(startedAt.getUTCMonth() - 11);
      startedAt.setUTCDate(1);
      const periodEnd = new Date();
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
      periodEnd.setUTCDate(1);
      const subscription = await prisma.subscription.create({
        data: {
          organizationId: explore.id,
          planId: campusPlan.id,
          status: 'active',
          amountCents: campusPlan.amountCents,
          currency: 'USD',
          interval: 'month',
          startedAt,
          currentPeriodStart: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
          currentPeriodEnd: periodEnd,
          notes: 'Campus plan for Explore College.',
        },
      });
      const invoices: Prisma.InvoiceCreateManyInput[] = [];
      for (let i = 11; i >= 0; i -= 1) {
        const issuedAt = new Date();
        issuedAt.setUTCMonth(issuedAt.getUTCMonth() - i);
        issuedAt.setUTCDate(3);
        const periodStart = new Date(Date.UTC(issuedAt.getUTCFullYear(), issuedAt.getUTCMonth(), 1));
        const nextPeriod = new Date(Date.UTC(issuedAt.getUTCFullYear(), issuedAt.getUTCMonth() + 1, 1));
        const isCurrent = i === 0;
        const status: InvoiceStatus = isCurrent ? 'open' : 'paid';
        invoices.push({
          organizationId: explore.id,
          subscriptionId: subscription.id,
          number: `INV-${issuedAt.getUTCFullYear()}-${String(12 - i).padStart(4, '0')}`,
          amountCents: campusPlan.amountCents,
          currency: 'USD',
          status,
          issuedAt,
          paidAt: isCurrent ? null : new Date(issuedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
          dueAt: new Date(issuedAt.getTime() + 14 * 24 * 60 * 60 * 1000),
          periodStart,
          periodEnd: nextPeriod,
          method: 'bank',
          notes: isCurrent ? 'Current period' : 'Paid on time',
        });
      }
      await prisma.invoice.createMany({ data: invoices });
      console.log('Campus subscription and payment history seeded for explore.');
    }
  } catch (err) {
    console.error('Seeding failed:', (err as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

const DEMO_STUDENT_EMAIL = 'student@explorecollege.org';
const DEMO_STUDENT_PASSWORD = 'student123';

const ensureDemoStudent = async (organizationId: string) => {
  const password = await hashPassword(DEMO_STUDENT_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: DEMO_STUDENT_EMAIL },
    update: {
      name: 'Ayesha Khan',
      password,
      role: 'applicant',
      organizationId,
      blocked: false,
    },
    create: {
      name: 'Ayesha Khan',
      email: DEMO_STUDENT_EMAIL,
      password,
      role: 'applicant',
      organizationId,
      blocked: false,
    },
  });

  await prisma.application.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    update: { status: 'accepted' },
    create: { userId: user.id, organizationId, status: 'accepted' },
  });

  let person = await prisma.attendancePerson.findFirst({
    where: { organizationId, email: DEMO_STUDENT_EMAIL },
  });
  if (!person) {
    person = await prisma.attendancePerson.create({
      data: {
        organizationId,
        kind: 'student',
        name: 'Ayesha Khan',
        title: 'Generic Nursing (BSN)',
        email: DEMO_STUDENT_EMAIL,
        active: true,
      },
    });
  }

  const bsnClass = await prisma.classSection.findFirst({
    where: { organizationId, code: 'BSN-Y1' },
  });
  if (bsnClass) {
    await prisma.classEnrollment.upsert({
      where: { classId_personId: { classId: bsnClass.id, personId: person.id } },
      update: {},
      create: { classId: bsnClass.id, personId: person.id },
    });
  }

  const today = dayStamp();
  await prisma.attendanceRecord.upsert({
    where: { personId_date: { personId: person.id, date: today } },
    update: { status: 'present' },
    create: { organizationId, personId: person.id, date: today, status: 'present' },
  });

  const teacher = await prisma.user.findFirst({ where: { organizationId, role: 'teacher' } });
  if (bsnClass && teacher) {
    const slot = await prisma.timetableSlot.findFirst({
      where: { classId: bsnClass.id },
      orderBy: { startTime: 'asc' },
    });
    let session = await prisma.attendanceSession.findFirst({
      where: { organizationId, classId: bsnClass.id, date: today },
    });
    if (!session) {
      session = await prisma.attendanceSession.create({
        data: {
          organizationId,
          classId: bsnClass.id,
          slotId: slot?.id || null,
          teacherId: teacher.id,
          date: today,
          qrToken: newQrToken(),
          qrExpiresAt: new Date(Date.now() + QR_TTL_MS),
          status: 'open',
        },
      });
    }
    await prisma.sessionAttendance.upsert({
      where: { sessionId_personId: { sessionId: session.id, personId: person.id } },
      update: {
        status: 'present',
        latitude: 31.5498,
        longitude: 74.3435,
        accuracy: 8,
        onCampus: true,
        distanceMeters: 12,
      },
      create: {
        sessionId: session.id,
        personId: person.id,
        status: 'present',
        latitude: 31.5498,
        longitude: 74.3435,
        accuracy: 8,
        onCampus: true,
        distanceMeters: 12,
      },
    });
  }

  console.log(
    `Demo student: ${DEMO_STUDENT_EMAIL} / ${DEMO_STUDENT_PASSWORD} — enrolled in BSN-Y1, present in class today`
  );
};

const ensureTodaySlots = async (organizationId: string, teacherId: string, bsnClassId: string, postClassId: string) => {
  const dayOfWeek = jsToWeekday(new Date());
  const existing = await prisma.timetableSlot.count({
    where: { organizationId, teacherId, dayOfWeek },
  });
  if (existing > 0) return;
  await prisma.timetableSlot.createMany({
    data: [
      {
        organizationId,
        classId: bsnClassId,
        teacherId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '10:30',
        room: 'Room 101',
      },
      {
        organizationId,
        classId: postClassId,
        teacherId,
        dayOfWeek,
        startTime: '11:00',
        endTime: '12:30',
        room: 'Room 102',
      },
    ],
  });
  console.log(`Today’s timetable slots added (weekday ${dayOfWeek}) for attendance testing.`);
};

run();
