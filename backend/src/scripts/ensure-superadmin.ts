import 'dotenv/config';
import { prisma } from '../config/db.js';
import { hashPassword } from '../middleware/auth.js';

const platformEmail = (process.env.PLATFORM_EMAIL || 'platform@explore.app').trim().toLowerCase();
const platformPassword = process.env.PLATFORM_PASSWORD || process.env.ADMIN_PASSWORD || '';

async function main() {
  if (!platformEmail || platformPassword.length < 6) {
    console.warn('Skipping superadmin ensure — set PLATFORM_EMAIL and PLATFORM_PASSWORD.');
    return;
  }
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
    console.log(`Super admin created: ${platformEmail}`);
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'superadmin', password, organizationId: null },
    });
    console.log(`Super admin updated: ${platformEmail}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
