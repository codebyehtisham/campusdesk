import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId, toSlug } from '../lib/tenant.js';
import { getScheme } from '../lib/schemes.js';

const toUnit = (row: { id: string; name: string; slug: string; description: string; sortOrder: number; active: boolean }) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  sortOrder: row.sortOrder,
  active: row.active,
});

export const getSchemeDesk = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.organization) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    const scheme = getScheme(req.organization.kind);
    const units = await prisma.orgUnit.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({
      kind: scheme.slug,
      label: scheme.label,
      units: units.map(toUnit),
      staffTitles: scheme.staffTitles,
      rosterTitles: scheme.rosterTitles,
      rosterLabels: scheme.rosterLabels,
      portalRoles: scheme.portalRoles,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load organisation scheme', error: (err as Error).message });
  }
};

export const listUnits = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const units = await prisma.orgUnit.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { people: true } } },
    });
    res.json(
      units.map((row) => ({
        ...toUnit(row),
        peopleCount: row._count.people,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load departments', error: (err as Error).message });
  }
};

export const createUnit = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Department name is required.' });
    const count = await prisma.orgUnit.count({ where: { organizationId } });
    const created = await prisma.orgUnit.create({
      data: {
        organizationId,
        name,
        slug: toSlug(req.body.slug || name),
        description: String(req.body.description || '').trim(),
        sortOrder: Number(req.body.sortOrder) || count + 1,
        active: req.body.active !== false,
      },
    });
    res.status(201).json(toUnit(created));
  } catch (err) {
    res.status(400).json({ message: 'Could not create this department.', error: (err as Error).message });
  }
};

export const updateUnit = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    const existing = await prisma.orgUnit.findFirst({ where: { id: req.params.id, organizationId: organizationId || undefined } });
    if (!existing) return res.status(404).json({ message: 'Department not found.' });
    const updated = await prisma.orgUnit.update({
      where: { id: existing.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        slug: req.body.slug != null ? toSlug(req.body.slug) : undefined,
        description: req.body.description != null ? String(req.body.description).trim() : undefined,
        sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) || existing.sortOrder : undefined,
        active: typeof req.body.active === 'boolean' ? req.body.active : undefined,
      },
    });
    res.json(toUnit(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update this department.', error: (err as Error).message });
  }
};

export const deleteUnit = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    const existing = await prisma.orgUnit.findFirst({ where: { id: req.params.id, organizationId: organizationId || undefined } });
    if (!existing) return res.status(404).json({ message: 'Department not found.' });
    await prisma.orgUnit.delete({ where: { id: existing.id } });
    res.json({ message: 'Department removed.', id: existing.id });
  } catch (err) {
    res.status(400).json({ message: 'Could not remove this department.', error: (err as Error).message });
  }
};
