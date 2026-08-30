import type { Organization, Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { sellableModules } from './tenant.js';

export const PORTAL_SLUGS = ['faculty', 'admissions', 'hr', 'finance', 'exams', 'library'] as const;
export type PortalSlug = (typeof PORTAL_SLUGS)[number];

export type StaffRoleDef = {
  role: Role;
  portal: PortalSlug;
  label: string;
  hint: string;
  /** Role is assignable when the org has at least one of these modules. */
  requiredModules: string[];
  canViewAdmissions?: boolean;
  canDecideAdmissions?: boolean;
  isTeacher?: boolean;
};

/** Legacy DB values mapped to current staff roles on read. */
export const LEGACY_ROLE_MAP: Record<string, Role> = {
  viewer: 'registrar',
  reader: 'registrar',
  reviewer: 'admissions_officer',
  officer: 'admissions_officer',
};

export const STAFF_ROLE_DEFS: StaffRoleDef[] = [
  {
    role: 'teacher',
    portal: 'faculty',
    label: 'Faculty member',
    hint: 'Teaches classes, runs timetable sessions, and marks student attendance.',
    requiredModules: ['faculty'],
    isTeacher: true,
  },
  {
    role: 'registrar',
    portal: 'admissions',
    label: 'Registrar',
    hint: 'Reviews student applications. Cannot accept or reject.',
    requiredModules: ['admissions'],
    canViewAdmissions: true,
  },
  {
    role: 'admissions_officer',
    portal: 'admissions',
    label: 'Admissions officer',
    hint: 'Reviews applications and makes accept/reject decisions.',
    requiredModules: ['admissions'],
    canViewAdmissions: true,
    canDecideAdmissions: true,
  },
  {
    role: 'hr_manager',
    portal: 'hr',
    label: 'HR manager',
    hint: 'Manages job openings, staff records, and staff attendance.',
    requiredModules: ['careers', 'staff-attendance'],
  },
  {
    role: 'accountant',
    portal: 'finance',
    label: 'Accountant',
    hint: 'Fee plans, receipts, and finance operations.',
    requiredModules: ['fees'],
  },
  {
    role: 'exam_controller',
    portal: 'exams',
    label: 'Exam controller',
    hint: 'Exam schedules, mark entry, and result cards.',
    requiredModules: ['examinations'],
  },
  {
    role: 'librarian',
    portal: 'library',
    label: 'Librarian',
    hint: 'Library catalog, issue/return, and member cards.',
    requiredModules: ['library'],
  },
];

export const ASSIGNABLE_STAFF_ROLES = STAFF_ROLE_DEFS.map((item) => item.role);

export const STAFF_ROLES = [...ASSIGNABLE_STAFF_ROLES, 'admin'] as const;

export const PORTAL_PATHS: Record<PortalSlug, string> = {
  faculty: '/faculty-portal',
  admissions: '/admissions-portal',
  hr: '/hr-portal',
  finance: '/finance-portal',
  exams: '/exams-portal',
  library: '/library-portal',
};

export const normalizeStaffRole = (role: string): Role => {
  const mapped = LEGACY_ROLE_MAP[role];
  return (mapped || role) as Role;
};

export const staffRoleDef = (role: string) =>
  STAFF_ROLE_DEFS.find((item) => item.role === normalizeStaffRole(role));

export const portalForRole = (role: string): PortalSlug | null => staffRoleDef(role)?.portal || null;

export const rolesForPortal = (portal: PortalSlug) => STAFF_ROLE_DEFS.filter((item) => item.portal === portal);

export const canViewAdmissionsRole = (role: string) => {
  const def = staffRoleDef(role);
  return Boolean(def?.canViewAdmissions) || role === 'admin';
};

export const canDecideAdmissionsRole = (role: string) => {
  const def = staffRoleDef(role);
  return Boolean(def?.canDecideAdmissions);
};

export const isTeacherRole = (role: string) => Boolean(staffRoleDef(role)?.isTeacher);

export const moduleForPortal = (portal: PortalSlug) => rolesForPortal(portal)[0]?.requiredModules[0];

export const roleModulesEnabled = (org: Pick<Organization, 'modules'> | { modules?: unknown } | null | undefined, role: string) => {
  const def = staffRoleDef(role);
  if (!def) return false;
  const modules = sellableModules(org?.modules);
  if (!def.requiredModules.length) return true;
  return def.requiredModules.some((slug) => modules.includes(slug));
};

export const assignableRolesForOrg = (org: Pick<Organization, 'modules'> | { modules?: unknown } | null | undefined) =>
  STAFF_ROLE_DEFS.filter((def) => roleModulesEnabled(org, def.role)).map((def) => def.role);

export const isRoleAssignable = (
  org: Pick<Organization, 'modules'> | { modules?: unknown } | null | undefined,
  role: string
) => roleModulesEnabled(org, normalizeStaffRole(role));

export const migrateLegacyRoles = async () => {
  await prisma.user.updateMany({ where: { role: 'viewer' }, data: { role: 'registrar' } });
  await prisma.user.updateMany({ where: { role: 'reader' }, data: { role: 'registrar' } });
  await prisma.user.updateMany({ where: { role: 'reviewer' }, data: { role: 'admissions_officer' } });
  await prisma.user.updateMany({ where: { role: 'officer' }, data: { role: 'admissions_officer' } });
};
