import type { Application, User } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId } from '../lib/tenant.js';
import {
  asAnswerMap,
  publicAdmissionForm,
  stringifyAnswers,
  validateAnswers,
  type AnswerMap,
} from '../lib/admissionForm.js';
import { loadOrgAdmissionForm } from './admissionFormController.js';

type AppWithPeople = Application & { user: User | null; reviewedBy: User | null };

const toApplication = (doc: Application, extras: Record<string, unknown> = {}) => ({
  id: doc.id,
  status: doc.status,
  answers: asAnswerMap(doc.answers),
  submittedAt: doc.submittedAt,
  updatedAt: doc.updatedAt,
  ...extras,
});

const toStaffApplication = (doc: AppWithPeople, includeAnswers = false) => ({
  id: doc.id,
  status: doc.status,
  updatedAt: doc.updatedAt,
  submittedAt: doc.submittedAt,
  reviewedAt: doc.reviewedAt,
  ...(includeAnswers ? { answers: asAnswerMap(doc.answers) } : {}),
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

const editableStatuses = new Set(['not_started', 'in_progress']);

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
    const form = await loadOrgAdmissionForm(organizationId);
    res.json(
      toApplication(application, {
        form: publicAdmissionForm(form),
        editable: editableStatuses.has(application.status),
      })
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load application', error: (err as Error).message });
  }
};

export const saveMine = async (req: Request, res: Response) => {
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
    if (!editableStatuses.has(application.status)) {
      return res.status(400).json({ message: 'This application can no longer be edited.' });
    }

    const form = await loadOrgAdmissionForm(organizationId);
    const allowed = new Set(form.groups.flatMap((g) => g.fields.map((f) => f.key)));
    const incoming = asAnswerMap(req.body.answers);
    const next: AnswerMap = { ...asAnswerMap(application.answers) };
    for (const [key, value] of Object.entries(incoming)) {
      if (!allowed.has(key)) continue;
      next[key] = value;
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        answers: stringifyAnswers(next),
        status: 'in_progress',
      },
    });
    res.json(
      toApplication(updated, {
        form: publicAdmissionForm(form),
        editable: true,
      })
    );
  } catch (err) {
    res.status(400).json({ message: 'Failed to save application', error: (err as Error).message });
  }
};

export const submitMine = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.user) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    const application = await prisma.application.findUnique({
      where: { userId_organizationId: { userId: req.user.id, organizationId } },
    });
    if (!application) return res.status(404).json({ message: 'Application not found' });
    if (!editableStatuses.has(application.status)) {
      return res.status(400).json({ message: 'This application was already submitted.' });
    }

    const form = await loadOrgAdmissionForm(organizationId);
    if (!form.published) {
      return res.status(400).json({ message: 'Admissions form is not open for submission.' });
    }

    const incoming = asAnswerMap(req.body.answers);
    const answers: AnswerMap = { ...asAnswerMap(application.answers), ...incoming };
    const errors = validateAnswers(form, answers);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: {
        answers: stringifyAnswers(answers),
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
    res.json(
      toApplication(updated, {
        form: publicAdmissionForm(form),
        editable: false,
      })
    );
  } catch (err) {
    res.status(400).json({ message: 'Failed to submit application', error: (err as Error).message });
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

    res.json(
      applications
        .filter((doc) => doc.user && doc.user.role === 'applicant')
        .map((doc) => toStaffApplication(doc, true))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load applications', error: (err as Error).message });
  }
};

export const getOne = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    const application = await prisma.application.findFirst({
      where: { id: req.params.id, organizationId: organizationId || undefined },
      include: { user: true, reviewedBy: true },
    });
    if (!application || application.user?.role !== 'applicant') {
      return res.status(404).json({ message: 'Application not found' });
    }
    const form = await loadOrgAdmissionForm(organizationId!);
    res.json({
      ...toStaffApplication(application, true),
      form: publicAdmissionForm(form),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load application', error: (err as Error).message });
  }
};

const provisionAcceptedStudent = async (organizationId: string, user: User) => {
  const email = String(user.email || '').trim().toLowerCase();
  const name = String(user.name || '').trim() || email || 'Student';
  if (!email) return null;

  const existing = await prisma.attendancePerson.findFirst({
    where: {
      organizationId,
      kind: 'student',
      email,
    },
  });
  if (existing) {
    return prisma.attendancePerson.update({
      where: { id: existing.id },
      data: { name, active: true, title: existing.title || 'Student' },
    });
  }
  return prisma.attendancePerson.create({
    data: {
      organizationId,
      kind: 'student',
      name,
      email,
      title: 'Student',
      active: true,
    },
  });
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
    if (application.status !== 'submitted' && application.status !== 'accepted' && application.status !== 'rejected') {
      return res.status(400).json({ message: 'Only submitted applications can be decided.' });
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

    if (decision === 'accepted' && updated.user) {
      await provisionAcceptedStudent(updated.organizationId, updated.user);
    } else if (decision === 'rejected' && updated.user?.email) {
      const person = await prisma.attendancePerson.findFirst({
        where: {
          organizationId: updated.organizationId,
          kind: 'student',
          email: updated.user.email.trim().toLowerCase(),
        },
      });
      if (person) {
        await prisma.attendancePerson.update({
          where: { id: person.id },
          data: { active: false },
        });
      }
    }

    res.json(toStaffApplication(updated, true));
  } catch (err) {
    res.status(400).json({ message: 'Failed to save decision', error: (err as Error).message });
  }
};
