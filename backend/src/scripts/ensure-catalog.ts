import 'dotenv/config';
import { prisma } from '../config/db.js';
import { ensurePlatformCatalog } from '../lib/seedCatalog.js';

async function main() {
  await ensurePlatformCatalog();
  const departments = await prisma.department.count();
  const modules = await prisma.module.count();
  const plans = await prisma.plan.count();
  console.log(`Catalog ready: ${departments} departments, ${modules} modules, ${plans} plans.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
