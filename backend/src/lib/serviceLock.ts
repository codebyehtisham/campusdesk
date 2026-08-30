import type { Organization } from '@prisma/client';
import { prisma } from '../config/db.js';
import { isTrialExpired } from './trial.js';

export const SUSPENDED_MESSAGE = 'Your services are suspended. Please contact the service provider.';

export const overdueOrgIds = async (organizationIds?: string[]) => {
  const now = new Date();
  const orgFilter = organizationIds?.length ? { organizationId: { in: organizationIds } } : {};
  const [invoices, subscriptions] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...orgFilter,
        status: { in: ['open', 'draft'] },
        OR: [{ dueAt: { lt: now } }, { dueAt: null, issuedAt: { lt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) } }],
      },
      select: { organizationId: true },
      distinct: ['organizationId'],
    }),
    prisma.subscription.findMany({
      where: { ...orgFilter, status: 'past_due' },
      select: { organizationId: true },
    }),
  ]);
  return new Set([...invoices, ...subscriptions].map((item) => item.organizationId));
};

export const resolveServiceLock = async (org: Organization | null | undefined) => {
  if (!org) return { locked: false, reason: null as string | null, overdue: false };
  const overdue = (await overdueOrgIds([org.id])).has(org.id);
  if (org.status === 'archived') {
    return { locked: true, reason: 'archived', overdue };
  }
  if (org.status !== 'active') {
    return { locked: true, reason: 'suspended', overdue };
  }
  if (org.isTrial && isTrialExpired(org)) {
    return { locked: true, reason: 'trial_expired', overdue };
  }
  if (org.suspendOnOverdue && overdue) {
    return { locked: true, reason: 'overdue', overdue };
  }
  return { locked: false, reason: null, overdue };
};

