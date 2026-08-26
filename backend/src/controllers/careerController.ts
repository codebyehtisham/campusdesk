import type { Career } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { getPublicOrganization, hasModule, orgId } from '../lib/tenant.js';

const toOpening = (doc: Career) => ({
  id: doc.id,
  title: doc.title,
  type: doc.type,
  desc: doc.desc,
  order: doc.order,
});

export const getOpenings = async (req: Request, res: Response) => {
  try {
    const org = req.organization || (await getPublicOrganization());
    if (!org || !hasModule(org, 'careers')) {
      return res.json([]);
    }
    const openings = await prisma.career.findMany({
      where: { organizationId: org.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(openings.map(toOpening));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch openings', error: (err as Error).message });
  }
};

export const createOpening = async (req: Request, res: Response) => {
  try {
    const title = String(req.body.title || '').trim();
    const desc = String(req.body.desc || '').trim();
    const type = req.body.type || 'Full-Time';
    if (!title || !desc) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const count = await prisma.career.count({ where: { organizationId } });
    const opening = await prisma.career.create({
      data: { organizationId, title, type, desc, order: count },
    });
    res.status(201).json(toOpening(opening));
  } catch (err) {
    res.status(400).json({ message: 'Failed to create opening', error: (err as Error).message });
  }
};

export const updateOpening = async (req: Request, res: Response) => {
  try {
    const opening = await prisma.career.findFirst({
      where: { id: req.params.id, organizationId: orgId(req) || undefined },
    });
    if (!opening) return res.status(404).json({ message: 'Opening not found' });
    if (req.body.title == null && req.body.desc == null && req.body.type == null) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }
    const updated = await prisma.career.update({
      where: { id: opening.id },
      data: {
        title: req.body.title != null ? String(req.body.title).trim() : undefined,
        desc: req.body.desc != null ? String(req.body.desc).trim() : undefined,
        type: req.body.type != null ? req.body.type : undefined,
      },
    });
    res.json(toOpening(updated));
  } catch (err) {
    res.status(400).json({ message: 'Failed to update opening', error: (err as Error).message });
  }
};

export const deleteOpening = async (req: Request, res: Response) => {
  try {
    const opening = await prisma.career.findFirst({
      where: { id: req.params.id, organizationId: orgId(req) || undefined },
    });
    if (!opening) return res.status(404).json({ message: 'Opening not found' });
    await prisma.career.delete({ where: { id: opening.id } });
    res.json({ message: 'Opening deleted', id: opening.id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete opening', error: (err as Error).message });
  }
};
