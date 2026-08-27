import type { Application, User } from '@prisma/client';
import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { prisma } from '../config/db.js';
import { readStoredObject, storageKeyFromFileUrl } from '../lib/storage.js';
import { parseDataUrlUpload, storeApplicationFile } from '../lib/applicationFiles.js';
import { orgId } from '../lib/tenant.js';
import {
  asAnswerMap,
  formatCnic,
  formatPhone,
  isCnicField,
  isPhoneField,
  parseAdmissionForm,
  parseStoredAdmissionForm,
  publicAdmissionForm,
  stringifyAnswers,
  validateAnswers,
  type AnswerMap,
  type AdmissionForm,
} from '../lib/admissionForm.js';
import { loadOrgAdmissionForm } from './admissionFormController.js';

type AppWithPeople = Application & { user: User | null; reviewedBy: User | null };

const formFromSnapshot = (raw: string | null | undefined): AdmissionForm | null => {
  if (!raw) return null;
  const stored = parseStoredAdmissionForm(raw);
  if (stored == null) return null;
  return parseAdmissionForm(stored);
};

const resolveReviewForm = async (organizationId: string, application: Application) => {
  const snap = formFromSnapshot(application.formSnapshot);
  if (snap) return publicAdmissionForm(snap);
  const live = await loadOrgAdmissionForm(organizationId);
  return publicAdmissionForm(live);
};

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

/** Make /uploads/... paths absolute so officer/faculty UIs can fetch docs reliably. */
const absolutizeFileAnswers = (answers: AnswerMap, baseUrl: string): AnswerMap => {
  const base = baseUrl.replace(/\/+$/, '');
  if (!base) return answers;
  const next: AnswerMap = { ...answers };
  for (const [key, value] of Object.entries(answers)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const file = value as { url?: string };
    if (typeof file.url !== 'string' || !file.url.startsWith('/')) continue;
    next[key] = { ...file, url: `${base}${file.url}` };
  }
  return next;
};

const requestPublicBase = (req: Request) => {
  const configured = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return '';
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${host}`;
};

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
    const form = editableStatuses.has(application.status)
      ? publicAdmissionForm(await loadOrgAdmissionForm(organizationId))
      : await resolveReviewForm(organizationId, application);
    res.json(
      toApplication(application, {
        form,
        editable: editableStatuses.has(application.status),
        documentsEditable:
          editableStatuses.has(application.status) || application.status === 'submitted',
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
    const fields = form.groups.flatMap((g) => g.fields);
    const allowed = new Set(fields.map((f) => f.key));
    const incoming = asAnswerMap(req.body.answers);
    const next: AnswerMap = { ...asAnswerMap(application.answers) };
    for (const [key, value] of Object.entries(incoming)) {
      if (!allowed.has(key)) continue;
      const field = fields.find((f) => f.key === key);
      if (field && isCnicField(field) && value != null && value !== '') {
        next[key] = formatCnic(value);
      } else if (field && isPhoneField(field) && value != null && value !== '') {
        next[key] = formatPhone(value);
      } else {
        next[key] = value;
      }
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
        formSnapshot: JSON.stringify(publicAdmissionForm(form)),
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
    const form = await resolveReviewForm(organizationId!, application);
    const base = requestPublicBase(req);
    const answers = absolutizeFileAnswers(asAnswerMap(application.answers), base);
    res.json({
      ...toStaffApplication(application, false),
      answers,
      form,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load application', error: (err as Error).message });
  }
};

export const streamApplicationFile = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    const fieldKey = String(req.params.fieldKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 48);
    if (!fieldKey) return res.status(400).json({ message: 'Document field is required.' });

    const application = await prisma.application.findFirst({
      where: { id: req.params.id, organizationId: organizationId || undefined },
      include: { user: true },
    });
    if (!application || application.user?.role !== 'applicant') {
      return res.status(404).json({ message: 'Application not found' });
    }

    const answers = asAnswerMap(application.answers);
    const raw = answers[fieldKey];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return res.status(404).json({ message: 'Document not found on this application.' });
    }
    const file = raw as { url?: string; mime?: string; name?: string };
    if (!file.url) {
      return res.status(404).json({ message: 'Document not found on this application.' });
    }

    const key = storageKeyFromFileUrl(String(file.url));
    if (!key) return res.status(404).json({ message: 'Document storage key is invalid.' });

    const object = await readStoredObject(key);
    if (!object?.body) {
      return res.status(404).json({
        message: 'File missing from cloud storage. Ask the applicant to open Apply and use Replace documents.',
      });
    }

    const mime = typeof file.mime === 'string' && file.mime ? file.mime : object.contentType;
    const name = typeof file.name === 'string' && file.name ? file.name : fieldKey;
    res.setHeader('Content-Type', mime);
    if (object.contentLength != null) res.setHeader('Content-Length', String(object.contentLength));
    res.setHeader('Content-Disposition', `inline; filename="${name.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (req.method === 'HEAD') return res.status(200).end();
    await pipeline(object.body, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Could not open document.', error: (err as Error).message });
    }
  }
};

export const replaceApplicationFile = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    const fieldKey = String(req.params.fieldKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 48);
    if (!fieldKey) return res.status(400).json({ message: 'Document field is required.' });

    const application = await prisma.application.findFirst({
      where: { id: req.params.id, organizationId },
      include: { user: true },
    });
    if (!application || application.user?.role !== 'applicant') {
      return res.status(404).json({ message: 'Application not found' });
    }
    if (['accepted', 'rejected'].includes(application.status)) {
      return res.status(400).json({ message: 'This application can no longer be edited.' });
    }

    const form = await loadOrgAdmissionForm(organizationId);
    const field = form.groups.flatMap((g) => g.fields).find((f) => f.key === fieldKey && f.type === 'file');
    if (!field) return res.status(400).json({ message: 'Unknown document field.' });

    const parsed = parseDataUrlUpload(String(req.body.file || ''), req.body.name);
    if ('error' in parsed) return res.status(400).json({ message: parsed.error });
    const maxBytes = Math.max(0.5, field.maxFileMb || 5) * 1024 * 1024;
    if (parsed.buffer.length > maxBytes) {
      return res.status(400).json({ message: `File must be ${field.maxFileMb} MB or smaller.` });
    }

    const stored = await storeApplicationFile({
      organizationId,
      applicationId: application.id,
      fieldKey,
      buffer: parsed.buffer,
      mime: parsed.mime,
      name: parsed.name,
    });
    const fileMeta = { url: stored.url, name: stored.name, size: stored.size, mime: stored.mime };
    const answers = { ...asAnswerMap(application.answers), [fieldKey]: fileMeta };
    await prisma.application.update({
      where: { id: application.id },
      data: { answers: stringifyAnswers(answers) },
    });

    res.json(fileMeta);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message || 'Could not upload file.' });
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
