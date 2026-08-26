import type { Department, Module, Organization, User } from '@prisma/client';
import type { Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma, pingPostgres } from '../config/db.js';
import { CACHE_KEYS, cacheDel, cacheGet, cacheSet, pingRedis } from '../config/redis.js';
import {
  bustOrgCache,
  isUniqueError,
  resolveOrgPack as packEntitlements,
  sellableModules,
  themeJson,
  toSlug,
} from '../lib/tenant.js';
import { overdueOrgIds, resolveServiceLock } from '../lib/serviceLock.js';
import { billingOverview } from '../lib/billing.js';
import { sanitizeTheme } from '../lib/theme.js';
import { hashPassword } from '../middleware/auth.js';
import { getScheme, parseOrgKind, publicSchemes, seedOrgUnits } from '../lib/schemes.js';

const backendVersion = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
).version as string;

type ModuleWithDept = Module & { department?: Pick<Department, 'id' | 'slug' | 'name'> | null };

const toModule = (doc: ModuleWithDept) => ({
  id: doc.id,
  slug: doc.slug,
  name: doc.name,
  description: doc.description,
  sortOrder: doc.sortOrder,
  active: doc.active,
  departmentId: doc.departmentId || null,
  departmentSlug: doc.department?.slug || null,
  departmentName: doc.department?.name || null,
});

const toDepartment = (doc: Department & { modules?: ModuleWithDept[] }) => ({
  id: doc.id,
  slug: doc.slug,
  name: doc.name,
  description: doc.description,
  sortOrder: doc.sortOrder,
  active: doc.active,
  modules: (doc.modules || []).filter((item) => item.slug !== 'audit').map(toModule),
});

const toOrg = (doc: Organization, adminCount = 0) => ({
  id: doc.id,
  name: doc.name,
  slug: doc.slug,
  title: doc.title || doc.name,
  tagline: doc.tagline || '',
  logo: doc.logo || '',
  kind: doc.kind,
  email: doc.email,
  phone: doc.phone,
  status: doc.status,
  departments: doc.departments || [],
  modules: sellableModules(doc.modules),
  isPublic: Boolean(doc.isPublic),
  suspendOnOverdue: Boolean(doc.suspendOnOverdue),
  notes: doc.notes || '',
  theme: sanitizeTheme(doc.theme),
  adminCount,
  createdAt: doc.createdAt,
});

const moduleInclude = { department: { select: { id: true, slug: true, name: true } } } as const;

const loadCatalog = async () => {
  const [departments, modules] = await Promise.all([
    prisma.department.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { modules: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    }),
    prisma.module.findMany({
      where: { slug: { not: 'audit' } },
      include: { department: { select: { id: true, slug: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);
  const assigned = new Set(departments.flatMap((dept) => dept.modules.map((item) => item.id)));
  return {
    departments: departments.map((dept) =>
      toDepartment({
        ...dept,
        modules: dept.modules.map((item) => ({
          ...item,
          department: { id: dept.id, slug: dept.slug, name: dept.name },
        })),
      })
    ),
    unassigned: modules.filter((item) => !assigned.has(item.id)).map(toModule),
  };
};

const resolveOrgPack = (req: Request, current: { departments: string[]; modules: string[] }) =>
  packEntitlements(req.body, current);

const bustCatalog = () => cacheDel(CACHE_KEYS.modules, CACHE_KEYS.catalog, CACHE_KEYS.platformDashboard);

const toAdmin = (doc: User) => ({
  id: doc.id,
  name: doc.name,
  email: doc.email,
  blocked: Boolean(doc.blocked),
  createdAt: doc.createdAt,
});

export const platformDashboard = async (_req: Request, res: Response) => {
  const started = Date.now();
  try {
    const cached = await cacheGet<unknown>(CACHE_KEYS.platformDashboard);
    if (cached) return res.json(cached);

    const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
    const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [postgres, redis, organizations, modules, orgAdmins, faculty, applicants, requestsHour, requestsDay, errorsDay, recent, billing] =
      await Promise.all([
        pingPostgres(),
        pingRedis(),
        prisma.organization.count(),
        prisma.module.count({ where: { active: true } }),
        prisma.user.count({ where: { role: 'admin' } }),
        prisma.user.count({ where: { role: { in: ['reader', 'officer', 'viewer', 'reviewer', 'teacher'] } } }),
        prisma.user.count({ where: { role: 'applicant' } }),
        prisma.auditLog.count({ where: { createdAt: { gte: sinceHour } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: sinceDay } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: sinceDay }, statusCode: { gte: 400 } } }),
        prisma.organization.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
        billingOverview(),
      ]);

    const mem = process.memoryUsage();
    const payload = {
      counts: { organizations, modules, orgAdmins, faculty, applicants },
      recent: recent.map((org) => toOrg(org)),
      services: [{ name: 'API', status: 'up', latencyMs: Date.now() - started }, postgres, redis],
      uptime: {
        seconds: Math.floor(process.uptime()),
        startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      },
      traffic: { lastHour: requestsHour, last24h: requestsDay, errors24h: errorsDay },
      memory: { rssMb: Math.round(mem.rss / 1024 / 1024), heapMb: Math.round(mem.heapUsed / 1024 / 1024) },
      versions: { backend: backendVersion, node: process.version.replace(/^v/, '') },
      evaluatedAt: new Date().toISOString(),
      billing,
    };
    await cacheSet(CACHE_KEYS.platformDashboard, payload, 20);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load platform dashboard', error: (err as Error).message });
  }
};

export const listCatalog = async (_req: Request, res: Response) => {
  try {
    const cached = await cacheGet<Awaited<ReturnType<typeof loadCatalog>>>(CACHE_KEYS.catalog);
    const payload = cached || (await loadCatalog());
    if (!cached) await cacheSet(CACHE_KEYS.catalog, payload, 120);
    res.json({ ...payload, schemes: publicSchemes() });
  } catch (err) {
    console.error('Catalog load failed:', err);
    res.status(500).json({ message: 'Failed to load catalog', error: (err as Error).message });
  }
};

export const listDepartments = async (_req: Request, res: Response) => {
  try {
    const items = await prisma.department.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { modules: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    });
    res.json(
      items.map((dept) =>
        toDepartment({
          ...dept,
          modules: dept.modules.map((item) => ({
            ...item,
            department: { id: dept.id, slug: dept.slug, name: dept.name },
          })),
        })
      )
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load departments', error: (err as Error).message });
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const slug = toSlug(req.body.slug || req.body.name);
    const name = String(req.body.name || '').trim();
    if (!slug || !name) {
      return res.status(400).json({ message: 'Department name is required.' });
    }
    const item = await prisma.department.create({
      data: {
        slug,
        name,
        description: String(req.body.description || '').trim(),
        sortOrder: Number(req.body.sortOrder) || 0,
        active: req.body.active !== false,
      },
      include: { modules: true },
    });
    await bustCatalog();
    res.status(201).json(toDepartment(item));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That department slug is already in use.' });
    res.status(400).json({ message: 'Failed to create department', error: (err as Error).message });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const item = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: 'Department not found' });
    const updated = await prisma.department.update({
      where: { id: item.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        description: req.body.description != null ? String(req.body.description).trim() : undefined,
        sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) || 0 : undefined,
        active: typeof req.body.active === 'boolean' ? req.body.active : undefined,
        slug: req.body.slug ? toSlug(req.body.slug) : undefined,
      },
      include: { modules: true },
    });
    await bustCatalog();
    res.json(toDepartment(updated));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That department slug is already in use.' });
    res.status(400).json({ message: 'Failed to update department', error: (err as Error).message });
  }
};

export const listModules = async (_req: Request, res: Response) => {
  try {
    const cached = await cacheGet<ReturnType<typeof toModule>[]>(CACHE_KEYS.modules);
    if (cached) return res.json(cached);
    const items = await prisma.module.findMany({
      include: moduleInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const payload = items.filter((item) => item.slug !== 'audit').map(toModule);
    await cacheSet(CACHE_KEYS.modules, payload, 300);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load modules', error: (err as Error).message });
  }
};

export const createModule = async (req: Request, res: Response) => {
  try {
    const slug = toSlug(req.body.slug || req.body.name);
    const name = String(req.body.name || '').trim();
    if (!slug || !name) {
      return res.status(400).json({ message: 'Name and a unique module slug are required.' });
    }
    if (slug === 'audit') {
      return res.status(400).json({ message: 'Audit is a platform-only feature, not a sellable module.' });
    }
    const departmentId = req.body.departmentId ? String(req.body.departmentId) : null;
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) return res.status(400).json({ message: 'Department not found.' });
    }
    const item = await prisma.module.create({
      data: {
        slug,
        name,
        description: String(req.body.description || '').trim(),
        sortOrder: Number(req.body.sortOrder) || 0,
        active: req.body.active !== false,
        departmentId,
      },
      include: moduleInclude,
    });
    await bustCatalog();
    res.status(201).json(toModule(item));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That module slug is already in use.' });
    res.status(400).json({ message: 'Failed to create module', error: (err as Error).message });
  }
};

export const updateModule = async (req: Request, res: Response) => {
  try {
    const item = await prisma.module.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: 'Module not found' });
    let departmentId: string | null | undefined;
    if (req.body.departmentId === null || req.body.departmentId === '') departmentId = null;
    else if (req.body.departmentId != null) {
      departmentId = String(req.body.departmentId);
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) return res.status(400).json({ message: 'Department not found.' });
    }
    const updated = await prisma.module.update({
      where: { id: item.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        description: req.body.description != null ? String(req.body.description).trim() : undefined,
        sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) || 0 : undefined,
        active: typeof req.body.active === 'boolean' ? req.body.active : undefined,
        slug: req.body.slug ? toSlug(req.body.slug) : undefined,
        departmentId,
      },
      include: moduleInclude,
    });
    await bustCatalog();
    res.json(toModule(updated));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That module slug is already in use.' });
    res.status(400).json({ message: 'Failed to update module', error: (err as Error).message });
  }
};

export const listOrganizations = async (_req: Request, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
    const counts = await prisma.user.groupBy({
      by: ['organizationId'],
      where: { role: 'admin' },
      _count: { _all: true },
    });
    const countMap = Object.fromEntries(counts.map((row) => [String(row.organizationId), row._count._all]));
    const overdue = await overdueOrgIds(orgs.map((org) => org.id));
    res.json(
      orgs.map((org) => ({
        ...toOrg(org, countMap[org.id] || 0),
        overdue: overdue.has(org.id),
        servicesLocked: org.status !== 'active' || (org.suspendOnOverdue && overdue.has(org.id)),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load organisations', error: (err as Error).message });
  }
};

export const createOrganization = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const slug = toSlug(req.body.slug || name);
    if (!name || !slug) {
      return res.status(400).json({ message: 'Organisation name is required.' });
    }
    const rawKind = String(req.body.kind || '').trim();
    if (rawKind !== 'education' && rawKind !== 'hospital') {
      return res.status(400).json({ message: 'Choose whether this organisation is an education institute or a hospital.' });
    }
    const kind = parseOrgKind(rawKind);
    const scheme = getScheme(kind);
    const requested = {
      departments: Array.isArray(req.body.departments) && req.body.departments.length ? req.body.departments : scheme.departments,
      modules: Array.isArray(req.body.modules) && req.body.modules.length ? req.body.modules : scheme.modules,
    };
    const pack = await packEntitlements(requested, { departments: [], modules: [] });

    if (req.body.isPublic) {
      await prisma.organization.updateMany({ data: { isPublic: false } });
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        email: String(req.body.email || '').trim().toLowerCase(),
        phone: String(req.body.phone || '').trim(),
        status: req.body.status === 'suspended' ? 'suspended' : 'active',
        kind,
        departments: pack.departments,
        modules: pack.modules,
        isPublic: Boolean(req.body.isPublic),
        suspendOnOverdue: Boolean(req.body.suspendOnOverdue),
        notes: String(req.body.notes || '').trim(),
        theme: themeJson(req.body.theme),
      },
    });
    await seedOrgUnits(org.id, kind);
    await bustOrgCache();
    res.status(201).json(toOrg(org, 0));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That organisation slug is already in use.' });
    res.status(400).json({ message: 'Failed to create organisation', error: (err as Error).message });
  }
};

export const updateOrganization = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });

    const entitlementsTouched = Array.isArray(req.body.departments) || Array.isArray(req.body.modules);
    const pack = entitlementsTouched
      ? await resolveOrgPack(req, { departments: org.departments || [], modules: org.modules || [] })
      : { departments: org.departments || [], modules: org.modules || [] };
    if (req.body.isPublic === true) {
      await prisma.organization.updateMany({ where: { id: { not: org.id } }, data: { isPublic: false } });
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        slug: req.body.slug ? toSlug(req.body.slug) : undefined,
        email: req.body.email != null ? String(req.body.email).trim().toLowerCase() : undefined,
        phone: req.body.phone != null ? String(req.body.phone).trim() : undefined,
        status: req.body.status === 'active' || req.body.status === 'suspended' ? req.body.status : undefined,
        notes: req.body.notes != null ? String(req.body.notes).trim() : undefined,
        kind: req.body.kind != null ? parseOrgKind(req.body.kind) : undefined,
        ...(entitlementsTouched ? { departments: pack.departments, modules: pack.modules } : {}),
        isPublic: typeof req.body.isPublic === 'boolean' ? req.body.isPublic : undefined,
        suspendOnOverdue: typeof req.body.suspendOnOverdue === 'boolean' ? req.body.suspendOnOverdue : undefined,
        theme: req.body.theme ? themeJson(req.body.theme) : undefined,
      },
    });
    const adminCount = await prisma.user.count({ where: { role: 'admin', organizationId: org.id } });
    await bustOrgCache();
    res.json(toOrg(updated, adminCount));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'That organisation slug is already in use.' });
    res.status(400).json({ message: 'Failed to update organisation', error: (err as Error).message });
  }
};

export const getOrganization = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const [admins, faculty, applicants, openings, applications] = await Promise.all([
      prisma.user.findMany({ where: { role: 'admin', organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where: { organizationId: org.id, role: { in: ['reader', 'officer', 'viewer', 'reviewer', 'teacher'] } } }),
      prisma.user.count({ where: { organizationId: org.id, role: 'applicant' } }),
      prisma.career.count({ where: { organizationId: org.id } }),
      prisma.application.count({ where: { organizationId: org.id } }),
    ]);
    const lock = await resolveServiceLock(org);
    res.json({
      ...toOrg(org, admins.length),
      overdue: lock.overdue,
      servicesLocked: lock.locked,
      lockReason: lock.reason,
      stats: { faculty, applicants, openings, applications },
      admins: admins.map(toAdmin),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load organisation', error: (err as Error).message });
  }
};

export const createOrgAdmin = async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ message: 'Organisation not found' });
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    if (!name || !email || password.length < 6) {
      return res.status(400).json({ message: 'Name, email, and a password of at least 6 characters are required.' });
    }
    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
        role: 'admin',
        organizationId: org.id,
        blocked: false,
      },
    });
    res.status(201).json(toAdmin(admin));
  } catch (err) {
    if (isUniqueError(err)) return res.status(409).json({ message: 'An account with this email already exists.' });
    res.status(400).json({ message: 'Failed to create admin', error: (err as Error).message });
  }
};

export const setOrgAdminBlocked = async (req: Request, res: Response) => {
  try {
    const admin = await prisma.user.findFirst({
      where: { id: req.params.adminId, organizationId: req.params.id, role: 'admin' },
    });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: { blocked: req.body.blocked === true },
    });
    res.json(toAdmin(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update admin access.', error: (err as Error).message });
  }
};

export const setOrgAdminPassword = async (req: Request, res: Response) => {
  try {
    const admin = await prisma.user.findFirst({
      where: { id: req.params.adminId, organizationId: req.params.id, role: 'admin' },
    });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const newPassword = String(req.body.newPassword || '').trim();
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    const updated = await prisma.user.update({
      where: { id: admin.id },
      data: { password: await hashPassword(newPassword) },
    });
    res.json({ message: 'Password updated.', admin: toAdmin(updated) });
  } catch (err) {
    res.status(400).json({ message: 'Could not update password.', error: (err as Error).message });
  }
};
