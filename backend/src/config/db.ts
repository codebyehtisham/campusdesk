import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const dbReady = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

export const pingPostgres = async () => {
  const started = Date.now();
  try {
    await dbReady();
    return { name: 'PostgreSQL', status: 'up' as const, latencyMs: Date.now() - started };
  } catch {
    return { name: 'PostgreSQL', status: 'down' as const, latencyMs: Date.now() - started };
  }
};
