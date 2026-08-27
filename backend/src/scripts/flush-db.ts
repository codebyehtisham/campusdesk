import 'dotenv/config';
import { prisma } from '../config/db.js';
import { getRedis } from '../config/redis.js';

const CONFIRM = ['1', 'true', 'yes'].includes(String(process.env.CONFIRM_DB_FLUSH || '').trim().toLowerCase());

async function flushRedis() {
  try {
    const redis = await getRedis();
    if (!redis) {
      console.warn('Redis flush skipped: not configured.');
      return;
    }
    await redis.flushDb();
    console.log('Redis cache flushed.');
  } catch (err) {
    console.warn(`Redis flush skipped: ${(err as Error).message}`);
  }
}

async function main() {
  if (!CONFIRM) {
    console.error('');
    console.error('Refusing to flush the database without confirmation.');
    console.error('Set CONFIRM_DB_FLUSH=1 and run again.');
    console.error('');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    console.error('DATABASE_URL must be a PostgreSQL connection string.');
    process.exit(1);
  }

  const superadmins = await prisma.user.findMany({ where: { role: 'superadmin' } });
  if (!superadmins.length) {
    console.warn('No superadmin users found — the database will be empty after flush.');
  } else {
    console.log(`Keeping ${superadmins.length} superadmin account(s): ${superadmins.map((u) => u.email).join(', ')}`);
  }

  await prisma.$transaction([
    prisma.sessionAttendance.deleteMany(),
    prisma.attendanceSession.deleteMany(),
    prisma.courseContent.deleteMany(),
    prisma.timetableSlot.deleteMany(),
    prisma.classEnrollment.deleteMany(),
    prisma.classSection.deleteMany(),
    prisma.attendanceRecord.deleteMany(),
    prisma.attendancePerson.deleteMany(),
    prisma.orgUnit.deleteMany(),
    prisma.application.deleteMany(),
    prisma.career.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.faculty.deleteMany(),
    prisma.course.deleteMany(),
    prisma.news.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.module.deleteMany(),
    prisma.department.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.user.deleteMany({ where: { role: { not: 'superadmin' } } }),
  ]);

  await flushRedis();

  const remainingUsers = await prisma.user.count();
  const remainingOrgs = await prisma.organization.count();
  console.log('');
  console.log('Database flush complete.');
  console.log(`Users remaining: ${remainingUsers}`);
  console.log(`Organisations remaining: ${remainingOrgs}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
