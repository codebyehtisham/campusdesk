import type { Organization, Role } from '@prisma/client';
import { prisma } from '../config/db.js';

export const PORTAL_SLUGS = ['faculty', 'admissions', 'hr', 'finance', 'exams', 'library'] as const;
export type PortalSlug = (typeof PORTAL_SLUGS)[number];

export type StaffRoleDef = {
  role: Role;
  portal: PortalSlug;
  label: string;
  hint: string;
  requiredModule?: string;
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
    requiredModule: 'faculty',
    isTeacher: true,
  },
  {
    role: 'registrar',
    portal: 'admissions',
    label: 'Registrar',
    hint: 'Reviews student applications. Cannot accept or reject.',
    requiredModule: 'admissions',
    canViewAdmissions: true,
  },
  {
    role: 'admissions_officer',
    portal: 'admissions',
    label: 'Admissions officer',
    hint: 'Reviews applications and makes accept/reject decisions.',
    requiredModule: 'admissions',
    canViewAdmissions: true,
    canDecideAdmissions: true,
  },
  {
    role: 'hr_manager',
    portal: 'hr',
    label: 'HR manager',
    hint: 'Manages job openings, staff records, and staff attendance.',
    requiredModule: 'careers',
  },
  {
    role: 'accountant',
    portal: 'finance',
    label: 'Accountant',
    hint: 'Fee plans, receipts, and finance operations.',
    requiredModule: 'fees',
  },
  {
    role: 'exam_controller',
    portal: 'exams',
    label: 'Exam controller',
    hint: 'Exam schedules, mark entry, and result cards.',
    requiredModule: 'examinations',
  },
  {
    role: 'librarian',
    portal: 'library',
    label: 'Librarian',
    hint: 'Library catalog, issue/return, and member cards.',
    requiredModule: 'library',
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

export const moduleForPortal = (portal: PortalSlug) => {
  const roles = rolesForPortal(portal);
  return roles[0]?.requiredModule;
};

export const migrateLegacyRoles = async () => {
  await prisma.user.updateMany({ where: { role: 'viewer' }, data: { role: 'registrar' } });
  await prisma.user.updateMany({ where: { role: 'reader' }, data: { role: 'registrar' } });
  await prisma.user.updateMany({ where: { role: 'reviewer' }, data: { role: 'admissions_officer' } });
  await prisma.user.updateMany({ where: { role: 'officer' }, data: { role: 'admissions_officer' } });
};
