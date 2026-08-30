import type { Role, User } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { isUniqueError, orgId } from '../lib/tenant.js';
import { assertTrialAllows, TrialLimitError } from '../lib/trial.js';
import { hashPassword } from '../middleware/auth.js';
import { getScheme } from '../lib/schemes.js';

const FACULTY_ROLES: Role[] = ['reader', 'officer', 'teacher'];
const EDITABLE_ROLES: Role[] = ['reader', 'officer', 'viewer', 'reviewer', 'teacher'];
const allowedRoles = (req: Request): Role[] => {
  const roles = getScheme(req.organization?.kind).portalRoles as Role[];
  return roles.length ? roles : FACULTY_ROLES;
};

const toUser = (doc: User) => ({
  id: doc.id,
  name: doc.name,
  email: doc.email,
  role: doc.role === 'viewer' ? 'reader' : doc.role === 'reviewer' ? 'officer' : doc.role,
  blocked: Boolean(doc.blocked),
  createdAt: doc.createdAt,
});

const facultyWhere = (req: Request) => ({
  organizationId: orgId(req) || undefined,
  role: { in: EDITABLE_ROLES },
});

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({ where: facultyWhere(req), orderBy: { createdAt: 'desc' } });
    res.json(users.map(toUser));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load users', error: (err as Error).message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const role = req.body.role as Role;

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ message: 'Name, email, and a password of at least 6 characters are required.' });
    }
    if (!allowedRoles(req).includes(role)) {
      return res.status(400).json({
        message: 'Choose a role that belongs to this organisation type. Admin accounts cannot be created here.',
      });
    }

    try {
      await assertTrialAllows(req.organization, 'faculty');
    } catch (err) {
      if (err instanceof TrialLimitError) return res.status(403).json({ message: err.message });
      throw err;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
        role,
        blocked: false,
        organizationId: orgId(req),
      },
    });
    res.status(201).json(toUser(user));
  } catch (err) {
    if (isUniqueError(err)) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    res.status(400).json({ message: 'Failed to create user', error: (err as Error).message });
  }
};

const findFaculty = (req: Request) =>
  prisma.user.findFirst({ where: { id: req.params.id, ...facultyWhere(req) } });

export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = await findFaculty(req);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.body.role && !allowedRoles(req).includes(req.body.role)) {
      return res.status(400).json({
        message: 'Choose a role that belongs to this organisation type. Admin accounts cannot be created here.',
      });
    }
    if (req.body.password) {
      const password = String(req.body.password).trim();
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        email: req.body.email != null ? String(req.body.email).trim().toLowerCase() : undefined,
        role: req.body.role || undefined,
        password: req.body.password ? await hashPassword(String(req.body.password).trim()) : undefined,
      },
    });
    res.json(toUser(updated));
  } catch (err) {
    if (isUniqueError(err)) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    res.status(400).json({ message: 'Failed to update user', error: (err as Error).message });
  }
};

export const setUserBlocked = async (req: Request, res: Response) => {
  try {
    const user = await findFaculty(req);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { blocked: req.body.blocked === true },
    });
    res.json(toUser(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update access.', error: (err as Error).message });
  }
};

export const setUserPassword = async (req: Request, res: Response) => {
  try {
    const user = await findFaculty(req);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const newPassword = String(req.body.newPassword || '').trim();
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword) },
    });
    res.json({ message: 'Password updated.', user: toUser(updated) });
  } catch (err) {
    res.status(400).json({ message: 'Could not update password.', error: (err as Error).message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await findFaculty(req);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await prisma.user.delete({ where: { id: user.id } });
    res.json({ message: 'User removed', id: user.id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete user', error: (err as Error).message });
  }
};
