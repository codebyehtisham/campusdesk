import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { withIds } from '../lib/tenant.js';

const buildFilter = (req: Request): Prisma.AuditLogWhereInput => {
  const filter: Prisma.AuditLogWhereInput = {};
  if (req.query.organization) filter.organizationId = String(req.query.organization);
  if (req.query.method) filter.method = String(req.query.method).toUpperCase();
  if (req.query.q) {
    const q = String(req.query.q);
    filter.OR = [
      { url: { contains: q, mode: 'insensitive' } },
      { ip: { contains: q, mode: 'insensitive' } },
      { userAgent: { contains: q, mode: 'insensitive' } },
    ];
  }
  return filter;
};

const toAudit = (item: {
  id: string;
  organization: { name: string; slug: string } | null;
  [key: string]: unknown;
}) => ({
  ...withIds(item),
  organization: item.organization,
});

export const listPlatformAudit = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
    const where = buildFilter(req);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          method: true,
          url: true,
          ip: true,
          location: true,
          statusCode: true,
          durationMs: true,
          createdAt: true,
          userAgent: true,
          actor: true,
          organizationId: true,
          organization: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      items: items.map(toAudit),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load audit trail', error: (err as Error).message });
  }
};

export const getPlatformAudit = async (req: Request, res: Response) => {
  try {
    const item = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
      include: { organization: { select: { name: true, slug: true } } },
    });
    if (!item) return res.status(404).json({ message: 'Audit record not found' });
    res.json(toAudit(item));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load audit record', error: (err as Error).message });
  }
};
