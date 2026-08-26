import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Organization, User } from '@prisma/client';
import { prisma } from '../config/db.js';
import { parseFence } from '../lib/geofence.js';
import { hasModule, sellableModules } from '../lib/tenant.js';
import { resolveServiceLock, SUSPENDED_MESSAGE } from '../lib/serviceLock.js';
import type { AuthPayload } from '../types/express.js';
import { getSiteSettings } from '../controllers/settingsController.js';

export const STAFF_ROLES = ['admin', 'reader', 'officer', 'viewer', 'reviewer', 'teacher'] as const;
export const FACULTY_ROLES = ['reader', 'officer', 'viewer', 'reviewer', 'teacher'] as const;
export const ADMISSIONS_ROLES = ['admin', 'reader', 'officer', 'viewer', 'reviewer'] as const;
export const DECISION_ROLES = ['officer', 'reviewer'] as const;

export const toSafeJSON = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  blocked: Boolean(user.blocked),
  organization: user.organizationId,
});

export const brandFields = (org: { name: string; title?: string | null; tagline?: string | null; logo?: string | null; slug?: string }) => ({
  title: String(org.title || '').trim() || org.name,
  tagline: String(org.tagline || '').trim(),
  logo: String(org.logo || '').trim(),
});

export const toOrgJSON = (org: Organization | null | undefined, lock?: { locked: boolean; reason: string | null; overdue: boolean }) =>
  org
    ? {
        id: org.id,
        name: org.name,
        slug: org.slug,
        email: org.email || '',
        status: org.status,
        modules: sellableModules(org.modules as unknown),
        suspendOnOverdue: Boolean(org.suspendOnOverdue),
        servicesLocked: Boolean(lock?.locked),
        lockReason: lock?.reason || null,
        overdue: Boolean(lock?.overdue),
        kind: org.kind,
        ...brandFields(org),
      }
    : null;

export const orgPayload = async (org: Organization | null) => {
  if (!org) return null;
  return toOrgJSON(org, await resolveServiceLock(org));
};

export const signToken = (user: User) =>
  jwt.sign(
    { id: user.id, role: user.role, orgId: user.organizationId || null },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

export const authPayload = (user: User, org: Organization | null, lock?: { locked: boolean; reason: string | null; overdue: boolean }): AuthPayload => ({
  token: signToken(user),
  user: toSafeJSON(user),
  organization: toOrgJSON(org, lock),
});

export const attendanceAuthExtras = async (org: Organization | null) => {
  if (!org || !hasModule(org, 'student-attendance')) {
    return { attendanceLocationEnabled: false, campusLocation: null };
  }
  const settings = await getSiteSettings(org.id);
  if (!settings) {
    return { attendanceLocationEnabled: false, campusLocation: null };
  }
  return {
    attendanceLocationEnabled: Boolean(settings.attendanceLocationEnabled),
    campusLocation: parseFence(settings),
  };
};

export const authPayloadForOrg = async (user: User, org: Organization | null) => {
  const lock = org ? await resolveServiceLock(org) : undefined;
  return {
    ...authPayload(user, org, lock),
    ...(await attendanceAuthExtras(org)),
  };
};

export const loadOrganization = async (user: User) => {
  if (!user.organizationId || user.role === 'superadmin') return null;
  return prisma.organization.findUnique({ where: { id: user.organizationId } });
};

export const matchPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);

/** Decode Bearer token and attach req.user when present — never rejects. Used before audit logging. */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  if (req.user) return next();
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret') as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (user && (!user.blocked || user.role === 'superadmin')) {
      req.user = user;
      req.organization = await loadOrganization(user);
    }
  } catch {
    /* invalid or expired token — leave anonymous */
  }
  return next();
};

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  if (req.user) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Sign in required' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret') as { id: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ message: 'Account not found' });
    if (user.blocked && user.role !== 'superadmin') {
      return res.status(403).json({ message: 'This account is blocked. Contact administration.' });
    }
    req.user = user;
    req.organization = await loadOrganization(user);
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Sign in again.' });
  }
};

export const requireOrgLinked = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === 'superadmin') return next();
  if (!req.organization) {
    return res.status(403).json({ message: 'Account is not linked to an organisation.' });
  }
  return next();
};

export const requireActiveOrg = async (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === 'superadmin') return next();
  if (!req.organization) {
    return res.status(403).json({ message: 'Account is not linked to an organisation.' });
  }
  const lock = await resolveServiceLock(req.organization);
  if (lock.locked) {
    return res.status(403).json({
      code: 'SERVICES_SUSPENDED',
      message: SUSPENDED_MESSAGE,
      lockReason: lock.reason,
    });
  }
  return next();
};

export const platformOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Platform access only' });
  }
  return next();
};

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  return next();
};

export const staffOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !STAFF_ROLES.includes(req.user.role as (typeof STAFF_ROLES)[number])) {
    return res.status(403).json({ message: 'Faculty access only' });
  }
  return next();
};

export const teacherOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ message: 'Faculty member access only' });
  }
  return next();
};

export const canViewAdmissions = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !ADMISSIONS_ROLES.includes(req.user.role as (typeof ADMISSIONS_ROLES)[number])) {
    return res.status(403).json({ message: 'You do not have permission to view student records.' });
  }
  return next();
};

export const canDecideAdmissions = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !DECISION_ROLES.includes(req.user.role as (typeof DECISION_ROLES)[number])) {
    return res.status(403).json({ message: 'Only admissions officers can accept or reject applicants.' });
  }
  return next();
};

export const applicantOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'applicant') {
    return res.status(403).json({ message: 'Applicant access only' });
  }
  return next();
};

export const requireModule = (slug: string) => (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === 'superadmin') return next();
  if (!hasModule(req.organization, slug)) {
    return res.status(403).json({ message: 'This service is not included in your subscription.' });
  }
  return next();
};
