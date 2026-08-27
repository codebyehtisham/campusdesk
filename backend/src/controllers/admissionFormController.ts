import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getSiteSettings } from './settingsController.js';
import {
  defaultAdmissionForm,
  emptyAdmissionForm,
  parseAdmissionForm,
  parseStoredAdmissionForm,
  publicAdmissionForm,
  sanitizeAdmissionFormInput,
} from '../lib/admissionForm.js';
import { hasModule, orgId, resolveOrganizationByInstitute, sellableModules } from '../lib/tenant.js';
import { brandFields } from '../middleware/auth.js';
import { CACHE_KEYS, cacheDel } from '../config/redis.js';

const uploadsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

const EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

export const loadOrgAdmissionForm = async (organizationId: string) => {
  const settings = await getSiteSettings(organizationId);
  if (!settings) return emptyAdmissionForm();
  const stored = parseStoredAdmissionForm(settings.admissionForm);
  if (stored == null) return defaultAdmissionForm();
  return parseAdmissionForm(stored);
};

export const getAdminAdmissionForm = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const form = await loadOrgAdmissionForm(organizationId);
    res.json(form);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load admission form', error: (err as Error).message });
  }
};

export const saveAdminAdmissionForm = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const form = sanitizeAdmissionFormInput(req.body);
    if (!form.groups.length) {
      return res.status(400).json({ message: 'Add at least one section with fields before saving.' });
    }
    for (const group of form.groups) {
      if (!group.fields.length) {
        return res.status(400).json({ message: `Section “${group.title}” needs at least one field.` });
      }
    }
    const settings = await getSiteSettings(organizationId);
    if (!settings) return res.status(400).json({ message: 'Could not save admission form.' });
    await prisma.setting.update({
      where: { id: settings.id },
      data: { admissionForm: JSON.stringify(form) },
    });
    await cacheDel(CACHE_KEYS.publicSettings, CACHE_KEYS.publicOrg);
    res.json(form);
  } catch (err) {
    res.status(400).json({ message: 'Failed to save admission form', error: (err as Error).message });
  }
};

export const getPublicAdmissionForm = async (req: Request, res: Response) => {
  try {
    const institute = String(req.query.institute || req.query.organizationSlug || '')
      .trim()
      .toLowerCase();
    const org = await resolveOrganizationByInstitute(institute || null);
    if (!org || org.status !== 'active') {
      return res.status(404).json({ message: 'Institute not found.' });
    }
    if (!hasModule(org, 'admissions')) {
      return res.status(404).json({ message: 'This institute is not taking applications here.' });
    }
    const settings = await getSiteSettings(org.id);
    const stored = parseStoredAdmissionForm(settings?.admissionForm);
    const form = stored == null ? defaultAdmissionForm() : parseAdmissionForm(stored);
    if (!form.published) {
      return res.status(404).json({ message: 'The admission form is not published yet.' });
    }
    res.json({
      admissionsOpen: Boolean(settings?.admissionsOpen),
      organization: {
        name: org.name,
        slug: org.slug,
        ...brandFields(org),
        modules: sellableModules(org.modules),
      },
      form: publicAdmissionForm(form),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load admission form', error: (err as Error).message });
  }
};

export const listAdmissionInstitutes = async (_req: Request, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { status: 'active' },
      orderBy: [{ isPublic: 'desc' }, { title: 'asc' }, { name: 'asc' }],
    });
    const rows = [];
    for (const org of orgs) {
      if (!hasModule(org, 'admissions')) continue;
      const settings = await getSiteSettings(org.id);
      if (!settings?.admissionsOpen) continue;
      const stored = parseStoredAdmissionForm(settings.admissionForm);
      const form = stored == null ? defaultAdmissionForm() : parseAdmissionForm(stored);
      if (!form.published) continue;
      rows.push({
        id: org.id,
        name: org.name,
        slug: org.slug,
        ...brandFields(org),
        tagline: org.tagline || brandFields(org).tagline,
      });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load institutes', error: (err as Error).message });
  }
};

export const uploadApplicationFile = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.user) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    const fieldKey = String(req.body.fieldKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 48);
    if (!fieldKey) return res.status(400).json({ message: 'fieldKey is required.' });

    const form = await loadOrgAdmissionForm(organizationId);
    const field = form.groups.flatMap((g) => g.fields).find((f) => f.key === fieldKey && f.type === 'file');
    if (!field) return res.status(400).json({ message: 'Unknown document field.' });

    const raw = String(req.body.file || '');
    const match = raw.match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) return res.status(400).json({ message: 'Upload a valid image or PDF file.' });
    const mime = match[1].toLowerCase();
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(mime)) {
      return res.status(400).json({ message: 'Use PNG, JPG, WEBP, GIF, or PDF.' });
    }
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ message: 'Choose a file to upload.' });
    const maxBytes = Math.max(0.5, field.maxFileMb || 5) * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(400).json({ message: `File must be ${field.maxFileMb} MB or smaller.` });
    }

    const application = await prisma.application.upsert({
      where: { userId_organizationId: { userId: req.user.id, organizationId } },
      update: {},
      create: { userId: req.user.id, organizationId, status: 'not_started' },
    });
    if (['accepted', 'rejected', 'submitted'].includes(application.status)) {
      return res.status(400).json({ message: 'This application can no longer be edited.' });
    }

    const ext = EXT[mime] || '.bin';
    const dir = path.join(uploadsRoot, organizationId, 'applications', application.id);
    await mkdir(dir, { recursive: true });
    const filename = `${fieldKey}${ext}`;
    await writeFile(path.join(dir, filename), buffer);
    const url = `/uploads/${organizationId}/applications/${application.id}/${filename}?v=${Date.now()}`;
    const name = clipFilename(req.body.name) || `${fieldKey}${ext}`;
    res.json({ url, name, size: buffer.length, mime });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message || 'Could not upload file.' });
  }
};

const clipFilename = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/[^\w.\- ()]/g, '')
    .slice(0, 120);
