import 'dotenv/config';
import { prisma } from '../config/db.js';
import { ensureEducationProgrammes } from '../lib/seedProgrammes.js';

async function main() {
  const result = await ensureEducationProgrammes();
  const total = await prisma.course.count();
  console.log(`Programmes ready: ${total} courses across ${result.orgs} education org(s) (${result.created} newly added).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
