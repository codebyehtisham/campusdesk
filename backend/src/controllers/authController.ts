import type { Request, Response } from 'express';
import type { Organization } from '@prisma/client';
import { prisma } from '../config/db.js';
import { getSiteSettings } from './settingsController.js';
import {
  attendanceAuthExtras,
  authPayloadForOrg,
  FACULTY_ROLES,
  hashPassword,
  loadOrganization,
  matchPassword,
  orgPayload,
  STAFF_ROLES,
  toSafeJSON,
} from '../middleware/auth.js';
import { hasModule, isUniqueError, resolveOrganizationByInstitute } from '../lib/tenant.js';
import { resolveServiceLock, SUSPENDED_MESSAGE } from '../lib/serviceLock.js';

const requireLinkedOrg = (org: Organization | null, res: Response): org is Organization => {
  if (!org) {
    res.status(403).json({ message: 'Account is not linked to an organisation.' });
    return false;
  }
  return true;
};

export const registerApplicant = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ message: 'Name, email, and a password of at least 6 characters are required.' });
    }

    const institute = String(req.body.institute || req.body.organizationSlug || '')
      .trim()
      .toLowerCase();

    let org: Organization | null = null;
    if (institute) {
      org = await resolveOrganizationByInstitute(institute);
      if (!org || org.slug !== institute) {
        return res.status(404).json({ message: 'That institute was not found on Campus Desk.' });
      }
      const lock = await resolveServiceLock(org);
      if (lock.locked) {
        return res.status(403).json({ code: 'SERVICES_SUSPENDED', message: SUSPENDED_MESSAGE, lockReason: lock.reason });
      }
      if (!hasModule(org, 'admissions')) {
        return res.status(403).json({ message: 'Admissions are not available for this organisation.' });
      }
      const settings = await getSiteSettings(org.id);
      if (!settings || !settings.admissionsOpen) {
        return res.status(403).json({ message: 'Admissions are closed right now.' });
      }
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
        role: 'applicant',
        organizationId: org?.id || null,
      },
    });
    if (org) {
      await prisma.application.create({ data: { userId: user.id, organizationId: org.id, status: 'not_started' } });
    }
    return res.status(201).json(await authPayloadForOrg(user, org));
  } catch (err) {
    if (isUniqueError(err)) {
      return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    }
    return res.status(400).json({ message: 'Could not create your account.', error: (err as Error).message });
  }
};

export const loginApplicant = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'applicant' || !(await matchPassword(password, user.password))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    if (user.blocked) {
      return res.status(403).json({ message: 'This account is blocked. Contact administration.' });
    }

    let org = await loadOrganization(user);
    const institute = String(req.body.institute || req.body.organizationSlug || '')
      .trim()
      .toLowerCase();

    if (institute) {
      const target = await resolveOrganizationByInstitute(institute);
      if (!target || target.slug !== institute) {
        return res.status(404).json({ message: 'That institute was not found on Campus Desk.' });
      }
      if (org && org.id !== target.id) {
        return res.status(403).json({
          message: 'This applicant account belongs to a different institute. Open Campus Desk from that college website.',
        });
      }
      if (!org) {
        const lock = await resolveServiceLock(target);
        if (lock.locked) {
          return res.status(403).json({ code: 'SERVICES_SUSPENDED', message: SUSPENDED_MESSAGE, lockReason: lock.reason });
        }
        if (!hasModule(target, 'admissions')) {
          return res.status(403).json({ message: 'Admissions are not available for this organisation.' });
        }
        const settings = await getSiteSettings(target.id);
        if (!settings || !settings.admissionsOpen) {
          return res.status(403).json({ message: 'Admissions are closed right now.' });
        }
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { organizationId: target.id },
        });
        await prisma.application.upsert({
          where: { userId_organizationId: { userId: user.id, organizationId: target.id } },
          update: {},
          create: { userId: user.id, organizationId: target.id, status: 'not_started' },
        });
        return res.json(await authPayloadForOrg(updated, target));
      }
    }

    if (org) {
      await prisma.application.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        update: {},
        create: { userId: user.id, organizationId: org.id, status: 'not_started' },
      });
    }

    return res.json(await authPayloadForOrg(user, org));
  } catch (err) {
    return res.status(500).json({ message: 'Could not sign in.', error: (err as Error).message });
  }
};

export const selectApplicantInstitute = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'applicant') {
      return res.status(403).json({ message: 'Applicant sign-in required.' });
    }
    const institute = String(req.body.institute || req.body.organizationSlug || '')
      .trim()
      .toLowerCase();
    if (!institute) {
      return res.status(400).json({ message: 'Choose an institute to continue.' });
    }

    const org = await resolveOrganizationByInstitute(institute);
    if (!org || org.slug !== institute) {
      return res.status(404).json({ message: 'That institute was not found on Campus Desk.' });
    }

    if (req.user.organizationId && req.user.organizationId !== org.id) {
      return res.status(403).json({
        message: 'This account is already linked to another institute.',
      });
    }

    const lock = await resolveServiceLock(org);
    if (lock.locked) {
      return res.status(403).json({ code: 'SERVICES_SUSPENDED', message: SUSPENDED_MESSAGE, lockReason: lock.reason });
    }
    if (!hasModule(org, 'admissions')) {
      return res.status(403).json({ message: 'Admissions are not available for this organisation.' });
    }
    const settings = await getSiteSettings(org.id);
    if (!settings || !settings.admissionsOpen) {
      return res.status(403).json({ message: 'Admissions are closed right now.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { organizationId: org.id },
    });
    await prisma.application.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: {},
      create: { userId: user.id, organizationId: org.id, status: 'not_started' },
    });

    return res.json(await authPayloadForOrg(user, org));
  } catch (err) {
    return res.status(400).json({ message: 'Could not select institute.', error: (err as Error).message });
  }
};

export const loginPlatform = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await matchPassword(password, user.password))) {
      return res.status(401).json({ message: 'Platform email or password is incorrect.' });
    }
    if (user.role !== 'superadmin') {
      return res.status(403).json({
        message: 'This account is an organisation admin. Sign in at /org-admin. Super admin uses platform@explore.app.',
      });
    }

    return res.json(await authPayloadForOrg(user, null));
  } catch (err) {
    return res.status(500).json({ message: 'Could not sign in.', error: (err as Error).message });
  }
};

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'admin' || !(await matchPassword(password, user.password))) {
      return res.status(401).json({ message: 'Staff email or password is incorrect.' });
    }
    if (user.blocked) {
      return res.status(403).json({ message: 'This account is blocked. Contact the platform team.' });
    }

    const org = await loadOrganization(user);
    if (!requireLinkedOrg(org, res)) return;

    return res.json(await authPayloadForOrg(user, org));
  } catch (err) {
    return res.status(500).json({ message: 'Could not sign in.', error: (err as Error).message });
  }
};

export const loginStaff = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]) ||
      user.role === 'superadmin' ||
      !(await matchPassword(password, user.password))
    ) {
      return res.status(401).json({ message: 'Faculty email or password is incorrect.' });
    }
    if (user.blocked) {
      return res.status(403).json({ message: 'This account is blocked. Contact administration.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Organisation admins sign in at /org-admin.' });
    }
    if (!FACULTY_ROLES.includes(user.role as (typeof FACULTY_ROLES)[number])) {
      return res.status(401).json({ message: 'Faculty email or password is incorrect.' });
    }

    const org = await loadOrganization(user);
    if (!requireLinkedOrg(org, res)) return;
    const lock = await resolveServiceLock(org);
    if (!lock.locked && !hasModule(org, 'faculty')) {
      return res.status(403).json({ message: 'Faculty portal is not included in this organisation’s subscription.' });
    }

    return res.json(await authPayloadForOrg(user, org));
  } catch (err) {
    return res.status(500).json({ message: 'Could not sign in.', error: (err as Error).message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const currentPassword = String(req.body.currentPassword || '').trim();
    const newPassword = String(req.body.newPassword || '').trim();
    if (!currentPassword) {
      return res.status(400).json({ message: 'Enter your current password.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Choose a password that is different from the current one.' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await matchPassword(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
    return res.json({ message: 'Password updated.' });
  } catch (err) {
    return res.status(400).json({ message: 'Could not update password.', error: (err as Error).message });
  }
};

export const getMe = async (req: Request, res: Response) => {
  res.json({
    user: toSafeJSON(req.user!),
    organization: await orgPayload(req.organization || null),
    ...(await attendanceAuthExtras(req.organization || null)),
  });
};
