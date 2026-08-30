import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

type NotifyInput = {
  userId: string;
  organizationId?: string | null;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

export const createNotification = async (input: NotifyInput) => {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId || null,
      type: input.type,
      title: input.title,
      body: input.body || '',
      data: (input.data || {}) as Prisma.InputJsonValue,
    },
  });
};

export const createNotifications = async (userIds: string[], input: Omit<NotifyInput, 'userId'>) => {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return [];
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      organizationId: input.organizationId || null,
      type: input.type,
      title: input.title,
      body: input.body || '',
      data: (input.data || {}) as Prisma.InputJsonValue,
    })),
  });
  return unique;
};

export const notifyHrManagers = async (
  organizationId: string,
  input: Omit<NotifyInput, 'userId' | 'organizationId'>
) => {
  const managers = await prisma.user.findMany({
    where: { organizationId, role: 'hr_manager', blocked: false },
    select: { id: true },
  });
  return createNotifications(
    managers.map((row) => row.id),
    { ...input, organizationId }
  );
};

export const toNotification = (row: {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  data: row.data,
  readAt: row.readAt,
  createdAt: row.createdAt,
  read: Boolean(row.readAt),
});
