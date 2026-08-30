import type { Organization } from '@prisma/client';
import { prisma } from '../config/db.js';

export const DEFAULT_TRIAL_CONFIG = {
  trialDays: 14,
  trialMaxAdmins: 1,
  trialMaxFaculty: 2,
  trialMaxStudents: 1,
} as const;

const FACULTY_ROLES = ['reader', 'officer', 'viewer', 'reviewer', 'teacher'] as const;

export type TrialConfig = {
  trialDays: number;
  trialMaxAdmins: number;
  trialMaxFaculty: number;
  trialMaxStudents: number;
};

export type TrialLimits = TrialConfig & {
  maxAdmins: number;
  maxFaculty: number;
  maxStudents: number;
};

export const ensurePlatformConfig = async () => {
  return prisma.platformConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', ...DEFAULT_TRIAL_CONFIG },
  });
};

export const getTrialConfig = async (): Promise<TrialConfig> => {
  const row = await ensurePlatformConfig();
  return {
    trialDays: row.trialDays,
    trialMaxAdmins: row.trialMaxAdmins,
    trialMaxFaculty: row.trialMaxFaculty,
    trialMaxStudents: row.trialMaxStudents,
  };
};

export const trialEndsAtFromDays = (days: number, from = new Date()) =>
  new Date(from.getTime() + Math.max(1, days) * 24 * 60 * 60 * 1000);

export const isTrialExpired = (org: Pick<Organization, 'isTrial' | 'trialEndsAt'>) =>
  Boolean(org.isTrial && org.trialEndsAt && org.trialEndsAt.getTime() < Date.now());

export const resolveTrialLimits = async (org: Organization): Promise<TrialLimits | null> => {
  if (!org.isTrial) return null;
  const config = await getTrialConfig();
  return {
    ...config,
    maxAdmins: org.trialMaxAdmins ?? config.trialMaxAdmins,
    maxFaculty: org.trialMaxFaculty ?? config.trialMaxFaculty,
    maxStudents: org.trialMaxStudents ?? config.trialMaxStudents,
  };
};

export const trialUsage = async (organizationId: string) => {
  const [admins, faculty, students] = await Promise.all([
    prisma.user.count({ where: { organizationId, role: 'admin' } }),
    prisma.user.count({ where: { organizationId, role: { in: [...FACULTY_ROLES] } } }),
    prisma.attendancePerson.count({ where: { organizationId, kind: 'student', active: true } }),
  ]);
  return { admins, faculty, students };
};

export type TrialStatus = {
  isTrial: boolean;
  trialEndsAt: string | null;
  expired: boolean;
  daysLeft: number | null;
  limits: TrialLimits | null;
  usage: { admins: number; faculty: number; students: number } | null;
};

export const trialStatusForOrg = async (org: Organization): Promise<TrialStatus> => {
  if (!org.isTrial) {
    return {
      isTrial: false,
      trialEndsAt: null,
      expired: false,
      daysLeft: null,
      limits: null,
      usage: null,
    };
  }
  const limits = await resolveTrialLimits(org);
  const usage = await trialUsage(org.id);
  const expired = isTrialExpired(org);
  const daysLeft =
    org.trialEndsAt == null
      ? null
      : Math.max(0, Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return {
    isTrial: true,
    trialEndsAt: org.trialEndsAt?.toISOString() || null,
    expired,
    daysLeft,
    limits,
    usage,
  };
};

export class TrialLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrialLimitError';
  }
}

export const assertTrialAllows = async (
  org: Organization | null | undefined,
  action: 'admin' | 'faculty' | 'student'
) => {
  if (!org?.isTrial) return;
  if (isTrialExpired(org)) {
    throw new TrialLimitError('This trial has ended. Contact the platform operator to upgrade.');
  }
  const limits = await resolveTrialLimits(org);
  if (!limits) return;
  const usage = await trialUsage(org.id);
  if (action === 'admin' && usage.admins >= limits.maxAdmins) {
    throw new TrialLimitError(
      `Trial limit reached: maximum ${limits.maxAdmins} org admin${limits.maxAdmins === 1 ? '' : 's'}.`
    );
  }
  if (action === 'faculty' && usage.faculty >= limits.maxFaculty) {
    throw new TrialLimitError(
      `Trial limit reached: maximum ${limits.maxFaculty} faculty member${limits.maxFaculty === 1 ? '' : 's'}.`
    );
  }
  if (action === 'student' && usage.students >= limits.maxStudents) {
    throw new TrialLimitError(
      `Trial limit reached: maximum ${limits.maxStudents} student${limits.maxStudents === 1 ? '' : 's'}.`
    );
  }
};
