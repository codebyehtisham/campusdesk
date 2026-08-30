import type { LeaveRequest, LeaveStatus, LeaveType } from '@prisma/client';
import { prisma } from '../config/db.js';

export const LEAVE_TYPES: LeaveType[] = ['sick', 'casual', 'maternity', 'annual'];

export const DEFAULT_LEAVE_QUOTAS: Record<LeaveType, number> = {
  annual: 15,
  sick: 7,
  casual: 7,
  maternity: 90,
};

export const eachDay = (start: Date, end: Date) => {
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

export const leaveDayCount = (start: Date, end: Date) => eachDay(start, end).length;

export const daysInYear = (start: Date, end: Date, year: number) => {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const clampedStart = start < yearStart ? yearStart : start;
  const clampedEnd = end > yearEnd ? yearEnd : end;
  if (clampedEnd < clampedStart) return 0;
  return leaveDayCount(clampedStart, clampedEnd);
};

const allowanceField = (type: LeaveType) => {
  if (type === 'annual') return 'annualAllowance' as const;
  if (type === 'sick') return 'sickAllowance' as const;
  if (type === 'casual') return 'casualAllowance' as const;
  return 'maternityAllowance' as const;
};

export const quotasForUser = (quota: {
  annualAllowance: number;
  sickAllowance: number;
  casualAllowance: number;
  maternityAllowance: number;
} | null) => ({
  annual: quota?.annualAllowance ?? DEFAULT_LEAVE_QUOTAS.annual,
  sick: quota?.sickAllowance ?? DEFAULT_LEAVE_QUOTAS.sick,
  casual: quota?.casualAllowance ?? DEFAULT_LEAVE_QUOTAS.casual,
  maternity: quota?.maternityAllowance ?? DEFAULT_LEAVE_QUOTAS.maternity,
});

const usageForLeaves = (leaves: LeaveRequest[], year: number, status: LeaveStatus) => {
  const usage: Record<LeaveType, number> = { sick: 0, casual: 0, maternity: 0, annual: 0 };
  leaves
    .filter((leave) => leave.status === status)
    .forEach((leave) => {
      usage[leave.type] += daysInYear(leave.startDate, leave.endDate, year);
    });
  return usage;
};

export const buildLeaveBalance = (
  allowances: Record<LeaveType, number>,
  leaves: LeaveRequest[],
  year = new Date().getUTCFullYear()
) => {
  const used = usageForLeaves(leaves, year, 'approved');
  const pending = usageForLeaves(leaves, year, 'pending');

  const types = LEAVE_TYPES.reduce(
    (acc, type) => {
      const allowance = allowances[type];
      const usedDays = used[type];
      const pendingDays = pending[type];
      const remaining = Math.max(0, allowance - usedDays);
      acc[type] = {
        allowance,
        used: usedDays,
        pending: pendingDays,
        remaining,
        available: Math.max(0, remaining - pendingDays),
      };
      return acc;
    },
    {} as Record<
      LeaveType,
      { allowance: number; used: number; pending: number; remaining: number; available: number }
    >
  );

  return { year, types };
};

export const getLeaveBalanceForUser = async (organizationId: string, userId: string, year?: number) => {
  const balanceYear = year ?? new Date().getUTCFullYear();
  const [quota, leaves] = await Promise.all([
    prisma.leaveQuota.findUnique({ where: { userId } }),
    prisma.leaveRequest.findMany({
      where: {
        organizationId,
        userId,
        OR: [
          { startDate: { gte: new Date(Date.UTC(balanceYear, 0, 1)), lte: new Date(Date.UTC(balanceYear, 11, 31)) } },
          { endDate: { gte: new Date(Date.UTC(balanceYear, 0, 1)), lte: new Date(Date.UTC(balanceYear, 11, 31)) } },
          {
            AND: [
              { startDate: { lte: new Date(Date.UTC(balanceYear, 0, 1)) } },
              { endDate: { gte: new Date(Date.UTC(balanceYear, 11, 31)) } },
            ],
          },
        ],
      },
    }),
  ]);

  return buildLeaveBalance(quotasForUser(quota), leaves, balanceYear);
};

export const assertLeaveDaysAvailable = async (
  organizationId: string,
  userId: string,
  type: LeaveType,
  startDate: Date,
  endDate: Date,
  excludeLeaveId?: string
) => {
  const year = startDate.getUTCFullYear();
  const requestedDays = daysInYear(startDate, endDate, year);
  if (requestedDays <= 0) return { ok: false as const, message: 'Choose valid leave dates.' };

  const balance = await getLeaveBalanceForUser(organizationId, userId, year);
  let available = balance.types[type].available;

  if (excludeLeaveId) {
    const existing = await prisma.leaveRequest.findFirst({
      where: { id: excludeLeaveId, organizationId, userId, type, status: 'pending' },
    });
    if (existing) {
      available += daysInYear(existing.startDate, existing.endDate, year);
    }
  }

  if (requestedDays > available) {
    return {
      ok: false as const,
      message: `Only ${available} ${type} leave day${available === 1 ? '' : 's'} available this year.`,
    };
  }

  return { ok: true as const, requestedDays };
};

export const allowancePayload = (body: Record<string, unknown>) => {
  const read = (type: LeaveType) => {
    const field = allowanceField(type);
    const raw = body[field] ?? body[type];
    if (raw === undefined || raw === null || raw === '') return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) return null;
    return value;
  };

  const annualAllowance = read('annual');
  const sickAllowance = read('sick');
  const casualAllowance = read('casual');
  const maternityAllowance = read('maternity');

  if ([annualAllowance, sickAllowance, casualAllowance, maternityAllowance].some((v) => v === null)) {
    return { error: 'Allowances must be whole numbers of zero or more.' };
  }

  return {
    annualAllowance: annualAllowance ?? DEFAULT_LEAVE_QUOTAS.annual,
    sickAllowance: sickAllowance ?? DEFAULT_LEAVE_QUOTAS.sick,
    casualAllowance: casualAllowance ?? DEFAULT_LEAVE_QUOTAS.casual,
    maternityAllowance: maternityAllowance ?? DEFAULT_LEAVE_QUOTAS.maternity,
  };
};
