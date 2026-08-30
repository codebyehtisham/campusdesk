import type { User } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export type PlatformActor = Pick<User, 'id' | 'email' | 'role'> | { id?: string; email?: string; role?: string };

export const logPlatformEvent = async (
  action: string,
  actor: PlatformActor | null | undefined,
  organizationId: string | null,
  metadata: Record<string, unknown> = {}
) => {
  try {
    await prisma.platformEvent.create({
      data: {
        action,
        actorId: actor?.id || null,
        actorEmail: actor?.email || '',
        organizationId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('[platform-event] failed:', (err as Error).message);
  }
};

export const listOrgPlatformEvents = (organizationId: string, limit = 50) =>
  prisma.platformEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
