import type { Application, User } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId } from '../lib/tenant.js';

type AppWithPeople = Application & { user: User | null; reviewedBy: User | null };

const toApplication = (doc: Application) => ({
  id: doc.id,
  status: doc.status,
  updatedAt: doc.updatedAt,
});

const toStaffApplication = (doc: AppWithPeople) => ({
  id: doc.id,
  status: doc.status,
  updatedAt: doc.updatedAt,
  reviewedAt: doc.reviewedAt,
  student: doc.user
    ? {
        id: doc.user.id,
        name: doc.user.name || 'Applicant',
        email: doc.user.email,
      }
    : null,
  reviewer: doc.reviewedBy
    ? {
        id: doc.reviewedBy.id,
        name: doc.reviewedBy.name,
        email: doc.reviewedBy.email,
      }
    : null,
});

export const getMine = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.user) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    const application = await prisma.application.upsert({
      where: { userId_organizationId: { userId: req.user.id, organizationId } },
      update: {},
      create: { userId: req.user.id, organizationId, status: 'not_started' },
    });
    res.json(toApplication(application));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load application', error: (err as Error).message });
  }
};

export const listAll = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    const applications = await prisma.application.findMany({
      where: { organizationId: organizationId || undefined },
      include: { user: true, reviewedBy: true },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(applications.filter((doc) => doc.user && doc.user.role === 'applicant').map(toStaffApplication));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load applications', error: (err as Error).message });
  }
};

export const decide = async (req: Request, res: Response) => {
  try {
    const decision = req.body.decision;
    if (!['accepted', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be accepted or rejected.' });
    }

    const application = await prisma.application.findFirst({
      where: { id: req.params.id, organizationId: orgId(req) || undefined },
      include: { user: true, reviewedBy: true },
    });
    if (!application || application.user?.role !== 'applicant') {
      return res.status(404).json({ message: 'Application not found' });
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        status: decision,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
      include: { user: true, reviewedBy: true },
    });
    res.json(toStaffApplication(updated));
  } catch (err) {
    res.status(400).json({ message: 'Failed to save decision', error: (err as Error).message });
  }
};
