import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { bustOrgCache, isUniqueError, themeJson, toSlug } from '../lib/tenant.js';
import { asStringList } from '../lib/lists.js';
import { logPlatformEvent, listOrgPlatformEvents } from '../lib/platformEvents.js';
import { getOrgUsage, listFleetUsage } from '../lib/usageMetering.js';
import { seedOrgUnits } from '../lib/schemes.js';
import { ensureOrgProgrammes } from '../lib/seedProgrammes.js';

const actor = (req: Request) => req.user || null;

export const suspendOrganization = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    if (org.status === 'archived') {
      return res.status(400).json({ message: 'Archived tenants must be restored before suspension changes.' });
    }
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { status: 'suspended', archivedAt: null },
    });
    await logPlatformEvent('tenant.suspended', actor(req), org.id, { previousStatus: org.status });
    await bustOrgCache();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to suspend tenant', error: (err as Error).message });
  }
};

export const activateOrganization = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const action = org.status === 'archived' ? 'tenant.restored' : 'tenant.activated';
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { status: 'active', archivedAt: null },
    });
    await logPlatformEvent(action, actor(req), org.id, { previousStatus: org.status });
    await bustOrgCache();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to activate tenant', error: (err as Error).message });
  }
};

export const archiveOrganization = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    if (org.isPublic) {
      await prisma.organization.updateMany({ where: { id: org.id }, data: { isPublic: false } });
    }
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { status: 'archived', archivedAt: new Date(), isPublic: false },
    });
    await logPlatformEvent('tenant.archived', actor(req), org.id, { previousStatus: org.status });
    await bustOrgCache();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to archive tenant', error: (err as Error).message });
  }
};

export const cloneOrganization = async (req: Request, res: Response) => {
  try {
    const source = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { settings: true },
    });
    if (!source) return res.status(404).json({ message: 'Organisation not found' });

    const name = String(req.body.name || `${source.name} Copy`).trim();
    const slug = toSlug(req.body.slug || name);
    if (!name || !slug) return res.status(400).json({ message: 'Name is required for the clone.' });

    const clone = await prisma.organization.create({
      data: {
        name,
        slug,
        title: source.title || name,
        tagline: source.tagline,
        logo: '',
        email: source.email,
        phone: source.phone,
        status: 'active',
        kind: source.kind,
        departments: source.departments ?? [],
        modules: source.modules ?? [],
        isPublic: false,
        suspendOnOverdue: source.suspendOnOverdue,
        notes: source.notes ? `Cloned from ${source.slug}. ${source.notes}` : `Cloned from ${source.slug}.`,
        theme: themeJson(source.theme),
      },
    });

    if (source.settings) {
      await prisma.setting.create({
        data: {
          organizationId: clone.id,
          admissionsOpen: source.settings.admissionsOpen,
          admissionForm: source.settings.admissionForm,
          attendanceLocationEnabled: source.settings.attendanceLocationEnabled,
          campusLatitude: source.settings.campusLatitude,
          campusLongitude: source.settings.campusLongitude,
          campusRadiusMeters: source.settings.campusRadiusMeters,
        },
      });
    }

    await seedOrgUnits(clone.id, clone.kind);
    if (clone.kind === 'education') {
      await ensureOrgProgrammes(clone.id);
    }

    await logPlatformEvent('tenant.cloned', actor(req), clone.id, {
      sourceOrganizationId: source.id,
      sourceSlug: source.slug,
    });
    await logPlatformEvent('tenant.provisioned', actor(req), clone.id, { via: 'clone', sourceSlug: source.slug });
    await bustOrgCache();
    res.status(201).json(clone);
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That organisation slug is already in use.' });
    res.status(400).json({ message: 'Failed to clone tenant', error: (err as Error).message });
  }
};

export const listOrganizationEvents = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const events = await listOrgPlatformEvents(org.id, Number(req.query.limit) || 50);
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load lifecycle events', error: (err as Error).message });
  }
};

export const getOrganizationUsage = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const usage = await getOrgUsage(org.id);
    res.json(usage);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load usage', error: (err as Error).message });
  }
};

export const listUsageFleet = async (_req: Request, res: Response) => {
  try {
    const fleet = await listFleetUsage();
    res.json(fleet);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load fleet usage', error: (err as Error).message });
  }
};
