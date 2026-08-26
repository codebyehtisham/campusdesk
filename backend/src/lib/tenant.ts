import type { Organization, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../config/db.js';
import { CACHE_KEYS, cacheDel, cacheGet, cacheSet } from '../config/redis.js';
import { sanitizeTheme } from './theme.js';

export const DEFAULT_DEPARTMENTS = [
  {
    slug: 'student-intake',
    name: 'Admissions',
    description: 'Applications, intake windows, and enrolment decisions.',
    sortOrder: 1,
  },
  {
    slug: 'human-resources',
    name: 'HR',
    description: 'Recruitment, job openings, and the public careers page.',
    sortOrder: 2,
  },
  {
    slug: 'academic-staff',
    name: 'Faculty',
    description: 'Faculty portal accounts, teaching classes, timetable, and access control.',
    sortOrder: 3,
  },
  {
    slug: 'campus-attendance',
    name: 'Attendance',
    description: 'Daily attendance for students, faculty, and campus staff.',
    sortOrder: 4,
  },
];

export const DEFAULT_MODULES = [
  {
    slug: 'admissions',
    name: 'Admissions',
    description: 'Student applications, intake open/close, and admission decisions.',
    sortOrder: 1,
    departmentSlug: 'student-intake',
  },
  {
    slug: 'interviews',
    name: 'Interviews',
    description: 'Applicant interview scheduling and scoring.',
    sortOrder: 2,
    departmentSlug: 'student-intake',
  },
  {
    slug: 'offers',
    name: 'Offers',
    description: 'Offer letters and acceptance tracking.',
    sortOrder: 3,
    departmentSlug: 'student-intake',
  },
  {
    slug: 'enrolment',
    name: 'Enrolment',
    description: 'Seat confirmation and enrolment documents.',
    sortOrder: 4,
    departmentSlug: 'student-intake',
  },
  {
    slug: 'waitlist',
    name: 'Waitlist',
    description: 'Waitlist management for oversubscribed programmes.',
    sortOrder: 5,
    departmentSlug: 'student-intake',
  },
  {
    slug: 'documents',
    name: 'Documents',
    description: 'Document collection and verification for applicants.',
    sortOrder: 6,
    departmentSlug: 'student-intake',
  },
  {
    slug: 'careers',
    name: 'Careers',
    description: 'Job openings managed by HR and listed on the public careers page.',
    sortOrder: 2,
    departmentSlug: 'human-resources',
  },
  {
    slug: 'faculty',
    name: 'Faculty',
    description: 'Faculty portal accounts, teaching classes, timetable, and access control.',
    sortOrder: 3,
    departmentSlug: 'academic-staff',
  },
  {
    slug: 'student-attendance',
    name: 'Student attendance',
    description: 'Daily attendance register for enrolled students.',
    sortOrder: 1,
    departmentSlug: 'campus-attendance',
  },
  {
    slug: 'staff-attendance',
    name: 'Staff attendance',
    description: 'Attendance for faculty, accountants, clerks, and other campus staff.',
    sortOrder: 2,
    departmentSlug: 'campus-attendance',
  },
];

export const toSlug = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const orgId = (req: Request) => req.organization?.id || req.user?.organizationId || null;

export const hasModule = (org: { modules?: string[] } | null | undefined, slug: string) =>
  Boolean(org?.modules?.includes(slug));

export const sellableModules = (modules: string[] = []) => modules.filter((slug) => slug !== 'audit');

export const withIds = <T extends { id: string }>(row: T) => ({ ...row, _id: row.id });

export const isUniqueError = (err: unknown) =>
  Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002');

export const getPublicOrganization = async () => {
  const cached = await cacheGet<Organization>(CACHE_KEYS.publicOrg);
  if (cached) return cached;

  const slug = (process.env.PUBLIC_ORG_SLUG || 'explore').toLowerCase();
  const org =
    (await prisma.organization.findFirst({ where: { isPublic: true, status: 'active' } })) ||
    (await prisma.organization.findFirst({ where: { slug, status: 'active' } })) ||
    (await prisma.organization.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'asc' } }));

  if (org) await cacheSet(CACHE_KEYS.publicOrg, org, 60);
  return org;
};

export const bustOrgCache = async () => {
  await cacheDel(
    CACHE_KEYS.publicOrg,
    CACHE_KEYS.publicSettings,
    CACHE_KEYS.modules,
    CACHE_KEYS.catalog,
    CACHE_KEYS.platformDashboard
  );
};

export const resolveEntitlements = async (departmentSlugs: string[]) => {
  const unique = [...new Set(departmentSlugs.map(String).filter(Boolean))];
  if (!unique.length) return { departments: [] as string[], modules: [] as string[] };
  const depts = await prisma.department.findMany({ where: { slug: { in: unique } } });
  return { departments: depts.map((item) => item.slug), modules: [] as string[] };
};

export const inferDepartments = async (moduleSlugs: string[]) => {
  if (!moduleSlugs.length) return [] as string[];
  const items = await prisma.module.findMany({
    where: { slug: { in: moduleSlugs } },
    select: { department: { select: { slug: true } } },
  });
  return [...new Set(items.map((item) => item.department?.slug).filter(Boolean))] as string[];
};

export const resolveOrgPack = async (
  body: { departments?: unknown; modules?: unknown },
  current: { departments: string[]; modules: string[] }
) => {
  const catalog = await prisma.department.findMany({
    include: { modules: { where: { slug: { not: 'audit' } } } },
  });
  const deptBySlug = new Map(catalog.map((item) => [item.slug, item]));
  const moduleMeta = new Map(
    catalog.flatMap((dept) => dept.modules.map((item) => [item.slug, { active: item.active, deptSlug: dept.slug }]))
  );

  let departments = [...current.departments];
  let modules = [...current.modules];

  if (Array.isArray(body.departments)) {
    const allowed = new Set(
      catalog.filter((item) => item.active || current.departments.includes(item.slug)).map((item) => item.slug)
    );
    departments = body.departments.map(String).filter((slug) => allowed.has(slug));
    const keep = new Set(departments);
    modules = modules.filter((slug) => {
      const meta = moduleMeta.get(slug);
      return Boolean(meta && keep.has(meta.deptSlug));
    });
  }

  if (Array.isArray(body.modules)) {
    const keep = new Set(departments);
    modules = body.modules.map(String).filter((slug) => {
      const meta = moduleMeta.get(slug);
      if (!meta || !meta.active) return false;
      if (!keep.has(meta.deptSlug)) {
        const dept = deptBySlug.get(meta.deptSlug);
        if (!dept || !(dept.active || current.departments.includes(dept.slug))) return false;
        departments.push(dept.slug);
        keep.add(dept.slug);
      }
      return keep.has(meta.deptSlug);
    });
  }

  return {
    departments: [...new Set(departments)],
    modules: [...new Set(sellableModules(modules))],
  };
};

export const themeJson = (input: unknown): Prisma.InputJsonValue => sanitizeTheme(input) as unknown as Prisma.InputJsonValue;
