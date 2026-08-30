import type { LeaveStatus, LeaveType } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import {
  allowancePayload,
  assertLeaveDaysAvailable,
  buildLeaveBalance,
  DEFAULT_LEAVE_QUOTAS,
  getLeaveBalanceForUser,
  LEAVE_TYPES,
  quotasForUser,
} from '../lib/leaveBalance.js';
import { ASSIGNABLE_STAFF_ROLES } from '../lib/roles.js';
import { createNotification, notifyHrManagers } from '../lib/notifications.js';
import { orgId } from '../lib/tenant.js';

const parseLeaveType = (value: unknown): LeaveType | null => {
  const type = String(value || '').trim() as LeaveType;
  return LEAVE_TYPES.includes(type) ? type : null;
};

const parseDay = (value: unknown) => {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const eachDay = (start: Date, end: Date) => {
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

const toLeave = (row: {
  id: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  reviewNotes: string;
  reviewedAt: Date | null;
  createdAt: Date;
  user?: { id: string; name: string; email: string; role: string };
  reviewedBy?: { id: string; name: string } | null;
}) => ({
  id: row.id,
  type: row.type,
  startDate: row.startDate.toISOString().slice(0, 10),
  endDate: row.endDate.toISOString().slice(0, 10),
  reason: row.reason,
  status: row.status,
  reviewNotes: row.reviewNotes,
  reviewedAt: row.reviewedAt,
  createdAt: row.createdAt,
  user: row.user
    ? { id: row.user.id, name: row.user.name, email: row.user.email, role: row.user.role }
    : undefined,
  reviewedBy: row.reviewedBy ? { id: row.reviewedBy.id, name: row.reviewedBy.name } : null,
});

export const getMyLeaveBalance = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const balance = await getLeaveBalanceForUser(organizationId, req.user!.id);
    res.json(balance);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load leave balance', error: (err as Error).message });
  }
};

export const listMyLeaves = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const [items, balance] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { organizationId, userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        include: { reviewedBy: { select: { id: true, name: true } } },
      }),
      getLeaveBalanceForUser(organizationId, req.user!.id),
    ]);
    res.json({ items: items.map(toLeave), balance });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load leave requests', error: (err as Error).message });
  }
};

export const submitLeave = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const type = parseLeaveType(req.body.type);
    const startDate = parseDay(req.body.startDate);
    const endDate = parseDay(req.body.endDate);
    if (!type) return res.status(400).json({ message: 'Choose sick, casual, maternity, or annual leave.' });
    if (!startDate || !endDate) return res.status(400).json({ message: 'Start and end dates are required.' });
    if (endDate < startDate) return res.status(400).json({ message: 'End date cannot be before start date.' });

    const availability = await assertLeaveDaysAvailable(organizationId, req.user!.id, type, startDate, endDate);
    if (!availability.ok) return res.status(400).json({ message: availability.message });

    const leave = await prisma.leaveRequest.create({
      data: {
        organizationId,
        userId: req.user!.id,
        type,
        startDate,
        endDate,
        reason: String(req.body.reason || '').trim(),
      },
      include: { reviewedBy: { select: { id: true, name: true } } },
    });

    const label = type.charAt(0).toUpperCase() + type.slice(1);
    await notifyHrManagers(organizationId, {
      type: 'leave_submitted',
      title: 'New leave request',
      body: `${req.user!.name || req.user!.email} submitted ${label} leave (${leave.startDate.toISOString().slice(0, 10)} – ${leave.endDate.toISOString().slice(0, 10)}).`,
      data: { leaveId: leave.id, userId: req.user!.id },
    });

    res.status(201).json(toLeave(leave));
  } catch (err) {
    res.status(400).json({ message: 'Failed to submit leave request', error: (err as Error).message });
  }
};

export const listHrLeaves = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const status = String(req.query.status || '').trim() as LeaveStatus;
    const items = await prisma.leaveRequest.findMany({
      where: {
        organizationId,
        ...(status && ['pending', 'approved', 'rejected'].includes(status) ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    res.json(items.map(toLeave));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load leave requests', error: (err as Error).message });
  }
};

export const getHrLeave = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });

    const leave = await prisma.leaveRequest.findFirst({
      where: { id: req.params.id, organizationId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    const [history, balance, quota] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { organizationId, userId: leave.userId },
        orderBy: { createdAt: 'desc' },
        include: { reviewedBy: { select: { id: true, name: true } } },
      }),
      getLeaveBalanceForUser(organizationId, leave.userId),
      prisma.leaveQuota.findUnique({ where: { userId: leave.userId } }),
    ]);

    const historyRows = history.map(toLeave);
    const historyByType = LEAVE_TYPES.reduce(
      (acc, type) => {
        acc[type] = historyRows.filter((row) => row.type === type);
        return acc;
      },
      {} as Record<LeaveType, ReturnType<typeof toLeave>[]>
    );

    res.json({
      leave: toLeave(leave),
      employee: leave.user,
      balance,
      quotas: quotasForUser(quota),
      history: historyRows,
      historyByType,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load leave request', error: (err as Error).message });
  }
};

export const decideLeave = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const decision = String(req.body.decision || '').trim() as LeaveStatus;
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ message: 'Decision must be approved or rejected.' });
    }

    const leave = await prisma.leaveRequest.findFirst({
      where: { id: req.params.id, organizationId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ message: 'This leave request was already reviewed.' });

    if (decision === 'approved') {
      const availability = await assertLeaveDaysAvailable(
        organizationId,
        leave.userId,
        leave.type,
        leave.startDate,
        leave.endDate,
        leave.id
      );
      if (!availability.ok) return res.status(400).json({ message: availability.message });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: decision,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes: String(req.body.reviewNotes || '').trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    await createNotification({
      userId: leave.userId,
      organizationId,
      type: decision === 'approved' ? 'leave_approved' : 'leave_rejected',
      title: decision === 'approved' ? 'Leave approved' : 'Leave rejected',
      body: `Your ${leave.type} leave (${leave.startDate.toISOString().slice(0, 10)} – ${leave.endDate.toISOString().slice(0, 10)}) was ${decision}.`,
      data: { leaveId: leave.id, decision },
    });

    res.json(toLeave(updated));
  } catch (err) {
    res.status(400).json({ message: 'Failed to update leave request', error: (err as Error).message });
  }
};

export const listHrLeaveQuotas = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });

    const staffUsers = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [...ASSIGNABLE_STAFF_ROLES] },
        blocked: false,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });

    const userIds = staffUsers.map((user) => user.id);
    const [quotas, leaves] = await Promise.all([
      prisma.leaveQuota.findMany({ where: { organizationId, userId: { in: userIds } } }),
      prisma.leaveRequest.findMany({
        where: { organizationId, userId: { in: userIds } },
      }),
    ]);

    const quotaByUser = new Map(quotas.map((quota) => [quota.userId, quota]));
    const leavesByUser = new Map<string, typeof leaves>();
    leaves.forEach((leave) => {
      const rows = leavesByUser.get(leave.userId) || [];
      rows.push(leave);
      leavesByUser.set(leave.userId, rows);
    });

    const year = new Date().getUTCFullYear();
    const employees = staffUsers.map((user) => {
      const quota = quotaByUser.get(user.id) || null;
      const allowances = quotasForUser(quota);
      const balance = buildLeaveBalance(
        allowances,
        leavesByUser.get(user.id) || [],
        year
      );
      return {
        user,
        quotas: allowances,
        balance: balance.types,
      };
    });

    res.json({ year, defaults: DEFAULT_LEAVE_QUOTAS, employees });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load leave quotas', error: (err as Error).message });
  }
};

export const upsertHrLeaveQuota = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });

    const user = await prisma.user.findFirst({
      where: {
        id: req.params.userId,
        organizationId,
        role: { in: [...ASSIGNABLE_STAFF_ROLES] },
        blocked: false,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return res.status(404).json({ message: 'Employee not found' });

    const parsed = allowancePayload(req.body);
    if ('error' in parsed) return res.status(400).json({ message: parsed.error });

    const quota = await prisma.leaveQuota.upsert({
      where: { userId: user.id },
      create: { organizationId, userId: user.id, ...parsed },
      update: parsed,
    });

    const balance = await getLeaveBalanceForUser(organizationId, user.id);
    res.json({
      user,
      quotas: quotasForUser(quota),
      balance,
    });
  } catch (err) {
    res.status(400).json({ message: 'Failed to save leave quota', error: (err as Error).message });
  }
};

export const hrAttendanceCalendar = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });

    const rawMonth = String(req.query.month || '').slice(0, 7);
    const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 0));

    const staffUsers = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [...ASSIGNABLE_STAFF_ROLES] },
        blocked: false,
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });

    const emails = staffUsers.map((u) => u.email.toLowerCase()).filter(Boolean);
    const people = await prisma.attendancePerson.findMany({
      where: { organizationId, kind: 'staff', email: { in: emails } },
      include: {
        records: {
          where: { date: { gte: start, lte: end } },
        },
      },
    });
    const personByEmail = new Map(people.map((p) => [p.email.toLowerCase(), p]));

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        organizationId,
        status: 'approved',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: { user: { select: { id: true } } },
    });

    const leaveDaysByUser = new Map<string, Set<string>>();
    approvedLeaves.forEach((leave) => {
      const set = leaveDaysByUser.get(leave.userId) || new Set<string>();
      eachDay(
        leave.startDate < start ? start : leave.startDate,
        leave.endDate > end ? end : leave.endDate
      ).forEach((day) => set.add(day));
      leaveDaysByUser.set(leave.userId, set);
    });

    const daysInMonth = end.getUTCDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(Date.UTC(year, mon - 1, i + 1));
      return d.toISOString().slice(0, 10);
    });

    const employees = staffUsers.map((user) => {
      const person = personByEmail.get(user.email.toLowerCase());
      const recordMap = new Map((person?.records || []).map((r) => [r.date.toISOString().slice(0, 10), r.status]));
      const leaveDays = leaveDaysByUser.get(user.id) || new Set<string>();
      const dayMap: Record<string, string> = {};
      days.forEach((day) => {
        if (leaveDays.has(day)) dayMap[day] = 'leave';
        else if (recordMap.has(day)) dayMap[day] = recordMap.get(day)!;
        else dayMap[day] = 'unmarked';
      });
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        days: dayMap,
      };
    });

    res.json({ month, days, employees });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load attendance calendar', error: (err as Error).message });
  }
};
