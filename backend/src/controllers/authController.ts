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
import { normalizeStaffRole, portalForRole } from '../lib/roles.js';
import { parsePortalSlug, portalLoginAllowed } from '../middleware/staffAuth.js';
import { createNotification } from '../lib/notifications.js';
import { resolveServiceLock, SUSPENDED_MESSAGE } from '../lib/serviceLock.js';
import { getPasswordPublicKey, passwordEncryptionVersion } from '../lib/passwordCrypto.js';
import { handlePasswordTransportError, plaintextPassword } from '../lib/passwordTransport.js';

const USE_MOBILE_APP_MESSAGE =
  'Campus tools are available in the Campus Desk mobile app. Download Campus Desk from the Play Store or the App Store and sign in with the same credentials.';
const MOBILE_AWAIT_CLASS_MESSAGE =
  'Your account is not assigned to a class yet. Once administration assigns your classes, sign in again from the Campus Desk mobile app.';

const requireLinkedOrg = (org: Organization | null, res: Response): org is Organization => {
  if (!org) {
    res.status(403).json({ message: 'Account is not linked to an organisation.' });
    return false;
  }
  return true;
};

async function applicantHasClassEnrollment(user: { email: string; organizationId: string | null }) {
  if (!user.organizationId) return false;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return false;
  const person = await prisma.attendancePerson.findFirst({
    where: {
      organizationId: user.organizationId,
      kind: 'student',
      email,
      active: true,
    },
    select: { id: true },
  });
  if (!person) return false;
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { personId: person.id },
    select: { id: true },
  });
  return Boolean(enrollment);
}

async function enforceApplicantClientGate(
  req: Request,
  res: Response,
  user: { email: string; organizationId: string | null }
) {
  const client = String(req.body.client || req.body.platform || '')
    .trim()
    .toLowerCase();
  if (client !== 'web' && client !== 'mobile') return true;

  const enrolled = await applicantHasClassEnrollment(user);
  if (client === 'web' && enrolled) {
    res.status(403).json({
      code: 'USE_MOBILE_APP',
      message: USE_MOBILE_APP_MESSAGE,
    });
    return false;
  }
  if (client === 'mobile' && !enrolled) {
    res.status(403).json({
      code: 'CLASS_NOT_ASSIGNED',
      message: MOBILE_AWAIT_CLASS_MESSAGE,
    });
    return false;
  }
  return true;
}

export const getPasswordKey = async (_req: Request, res: Response) => {
  res.json({ version: passwordEncryptionVersion(), publicKey: getPasswordPublicKey() });
};

export const registerApplicant = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = plaintextPassword(req.body.password);

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
    if (handlePasswordTransportError(res, err)) return;
    if (isUniqueError(err)) {
      return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    }
    return res.status(400).json({ message: 'Could not create your account.', error: (err as Error).message });
  }
};

export const loginApplicant = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = plaintextPassword(req.body.password);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'applicant') {
      return res.status(401).json({
        message: 'Email or password is incorrect. No applicant account found for this email — create an account first.',
      });
    }
    if (!(await matchPassword(password, user.password))) {
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
        if (!(await enforceApplicantClientGate(req, res, updated))) return;
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

    if (!(await enforceApplicantClientGate(req, res, user))) return;
    return res.json(await authPayloadForOrg(user, org));
  } catch (err) {
    if (handlePasswordTransportError(res, err)) return;
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
    const password = plaintextPassword(req.body.password);
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
    if (handlePasswordTransportError(res, err)) return;
    return res.status(500).json({ message: 'Could not sign in.', error: (err as Error).message });
  }
};

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = plaintextPassword(req.body.password);
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
    if (handlePasswordTransportError(res, err)) return;
    return res.status(500).json({ message: 'Could not sign in.', error: (err as Error).message });
  }
};

export const loginStaff = async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = plaintextPassword(req.body.password);
    const portal = parsePortalSlug(req.body.portal) || 'faculty';
    const user = await prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !FACULTY_ROLES.includes(user.role as (typeof FACULTY_ROLES)[number]) ||
      user.role === 'superadmin' ||
      !(await matchPassword(password, user.password))
    ) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    if (user.blocked) {
      return res.status(403).json({ message: 'This account is blocked. Contact administration.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Organisation admins sign in at /org-admin.' });
    }

    const org = await loadOrganization(user);
    if (!requireLinkedOrg(org, res)) return;
    const gate = portalLoginAllowed(normalizeStaffRole(user.role), portal, org);
    if (!gate.ok) return res.status(403).json({ message: gate.message });

    return res.json({
      ...(await authPayloadForOrg(user, org)),
      portal,
      portalPath: portalForRole(user.role),
    });
  } catch (err) {
    if (handlePasswordTransportError(res, err)) return;
    return res.status(500).json({ message: 'Could not sign in.', error: (err as Error).message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const currentPassword = plaintextPassword(req.body.currentPassword);
    const newPassword = plaintextPassword(req.body.newPassword);
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
    await createNotification({
      userId: user.id,
      organizationId: user.organizationId,
      type: 'password_changed',
      title: 'Password updated',
      body: 'Your password was changed successfully. If you did not make this change, contact your administrator right away.',
      data: { selfService: true },
    });
    return res.json({ message: 'Password updated.' });
  } catch (err) {
    if (handlePasswordTransportError(res, err)) return;
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
