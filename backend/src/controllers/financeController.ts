import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId } from '../lib/tenant.js';

const syncFeeStatus = (due: number, paid: number) => {
  if (paid <= 0) return 'open';
  if (paid >= due) return 'paid';
  return 'partial';
};

export const getFinanceOverview = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });

    const [plans, fees, payments] = await Promise.all([
      prisma.feePlan.count({ where: { organizationId, active: true } }),
      prisma.studentFee.findMany({ where: { organizationId } }),
      prisma.feePayment.aggregate({
        where: { organizationId },
        _sum: { amountCents: true },
      }),
    ]);

    const totalDue = fees.reduce((sum, item) => sum + item.amountDueCents, 0);
    const totalPaid = fees.reduce((sum, item) => sum + item.amountPaidCents, 0);
    const defaulters = fees.filter((item) => item.amountPaidCents < item.amountDueCents).length;

    res.json({
      activePlans: plans,
      studentAccounts: fees.length,
      totalDueCents: totalDue,
      totalPaidCents: totalPaid,
      outstandingCents: Math.max(0, totalDue - totalPaid),
      defaulters,
      paymentsRecordedCents: payments._sum.amountCents || 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load finance overview', error: (err as Error).message });
  }
};

export const listFeePlans = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const plans = await prisma.feePlan.findMany({
      where: { organizationId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load fee plans', error: (err as Error).message });
  }
};

export const createFeePlan = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const name = String(req.body.name || '').trim();
    const amountCents = Number(req.body.amountCents);
    if (!name || !Number.isFinite(amountCents) || amountCents < 0) {
      return res.status(400).json({ message: 'Name and a valid amount are required.' });
    }
    const plan = await prisma.feePlan.create({
      data: {
        organizationId,
        name,
        amountCents: Math.round(amountCents),
        currency: String(req.body.currency || 'PKR').trim() || 'PKR',
      },
    });
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create fee plan', error: (err as Error).message });
  }
};

export const updateFeePlan = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const plan = await prisma.feePlan.findFirst({ where: { id: req.params.id, organizationId } });
    if (!plan) return res.status(404).json({ message: 'Fee plan not found' });
    const updated = await prisma.feePlan.update({
      where: { id: plan.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        amountCents: req.body.amountCents != null ? Math.round(Number(req.body.amountCents)) : undefined,
        currency: req.body.currency != null ? String(req.body.currency).trim() : undefined,
        active: req.body.active != null ? Boolean(req.body.active) : undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update fee plan', error: (err as Error).message });
  }
};

export const listStudentFees = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const fees = await prisma.studentFee.findMany({
      where: { organizationId },
      include: {
        person: { select: { id: true, name: true, title: true, email: true } },
        plan: { select: { id: true, name: true } },
        payments: { orderBy: { paidAt: 'desc' }, take: 3 },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load student fees', error: (err as Error).message });
  }
};

export const createStudentFee = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const personId = String(req.body.personId || '').trim();
    if (!personId) return res.status(400).json({ message: 'Choose a student.' });

    const person = await prisma.attendancePerson.findFirst({
      where: { id: personId, organizationId, kind: 'student' },
    });
    if (!person) return res.status(404).json({ message: 'Student not found on the attendance roster.' });

    let amountDueCents = Number(req.body.amountDueCents);
    let planId: string | null = null;
    let label = String(req.body.label || '').trim();

    if (req.body.planId) {
      const plan = await prisma.feePlan.findFirst({
        where: { id: String(req.body.planId), organizationId, active: true },
      });
      if (!plan) return res.status(404).json({ message: 'Fee plan not found' });
      planId = plan.id;
      amountDueCents = plan.amountCents;
      if (!label) label = plan.name;
    }

    if (!Number.isFinite(amountDueCents) || amountDueCents < 0) {
      return res.status(400).json({ message: 'Amount due is required.' });
    }

    const fee = await prisma.studentFee.create({
      data: {
        organizationId,
        personId,
        planId,
        label: label || 'Fee',
        amountDueCents: Math.round(amountDueCents),
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
        notes: String(req.body.notes || '').trim(),
      },
      include: {
        person: { select: { id: true, name: true, title: true, email: true } },
        plan: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(fee);
  } catch (err) {
    res.status(400).json({ message: 'Failed to assign fee', error: (err as Error).message });
  }
};

export const recordFeePayment = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const studentFeeId = String(req.body.studentFeeId || '').trim();
    const amountCents = Math.round(Number(req.body.amountCents));
    if (!studentFeeId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ message: 'Fee account and payment amount are required.' });
    }

    const fee = await prisma.studentFee.findFirst({ where: { id: studentFeeId, organizationId } });
    if (!fee) return res.status(404).json({ message: 'Student fee account not found' });

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.feePayment.create({
        data: {
          organizationId,
          studentFeeId: fee.id,
          amountCents,
          method: String(req.body.method || 'cash').trim() || 'cash',
          notes: String(req.body.notes || '').trim(),
          recordedById: req.user?.id || null,
          paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
        },
      });
      const nextPaid = fee.amountPaidCents + amountCents;
      await tx.studentFee.update({
        where: { id: fee.id },
        data: {
          amountPaidCents: nextPaid,
          status: syncFeeStatus(fee.amountDueCents, nextPaid),
        },
      });
      return created;
    });

    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ message: 'Failed to record payment', error: (err as Error).message });
  }
};

export const listFinanceStudents = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const students = await prisma.attendancePerson.findMany({
      where: { organizationId, kind: 'student', active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, title: true, email: true },
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load students', error: (err as Error).message });
  }
};
