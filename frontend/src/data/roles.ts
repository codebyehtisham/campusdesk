import {
  ADMISSIONS_PORTAL_BASE,
  EXAMS_PORTAL_BASE,
  FACULTY_BASE,
  FINANCE_PORTAL_BASE,
  HR_PORTAL_BASE,
  LIBRARY_PORTAL_BASE,
} from '../admin/paths';

export const STAFF_ROLES = [
  {
    key: 'teacher',
    label: 'Faculty member',
    hint: 'Teaches classes, runs timetable sessions, and marks student attendance.',
    portal: 'faculty',
    portalPath: FACULTY_BASE,
    portalLabel: 'Faculty portal',
  },
  {
    key: 'registrar',
    label: 'Registrar',
    hint: 'Reviews student applications. Cannot accept or reject.',
    portal: 'admissions',
    portalPath: ADMISSIONS_PORTAL_BASE,
    portalLabel: 'Admissions portal',
  },
  {
    key: 'admissions_officer',
    label: 'Admissions officer',
    hint: 'Reviews applications and makes accept/reject decisions.',
    portal: 'admissions',
    portalPath: ADMISSIONS_PORTAL_BASE,
    portalLabel: 'Admissions portal',
  },
  {
    key: 'hr_manager',
    label: 'HR manager',
    hint: 'Manages job openings, staff records, and staff attendance.',
    portal: 'hr',
    portalPath: HR_PORTAL_BASE,
    portalLabel: 'HR portal',
  },
  {
    key: 'accountant',
    label: 'Accountant',
    hint: 'Fee plans, receipts, and finance operations.',
    portal: 'finance',
    portalPath: FINANCE_PORTAL_BASE,
    portalLabel: 'Finance portal',
  },
  {
    key: 'exam_controller',
    label: 'Exam controller',
    hint: 'Exam schedules, mark entry, and result cards.',
    portal: 'exams',
    portalPath: EXAMS_PORTAL_BASE,
    portalLabel: 'Exams portal',
  },
  {
    key: 'librarian',
    label: 'Librarian',
    hint: 'Library catalog, issue/return, and member cards.',
    portal: 'library',
    portalPath: LIBRARY_PORTAL_BASE,
    portalLabel: 'Library portal',
  },
];

const LEGACY = {
  viewer: 'registrar',
  reader: 'registrar',
  reviewer: 'admissions_officer',
  officer: 'admissions_officer',
};

export const normalizeRole = (role) => LEGACY[role] || role;

export const roleDef = (role) => STAFF_ROLES.find((item) => item.key === normalizeRole(role));

export const roleLabel = (role) => roleDef(role)?.label || role;

export const portalPathForRole = (role) => roleDef(role)?.portalPath || FACULTY_BASE;

export const isTeacher = (role) => normalizeRole(role) === 'teacher';

export const canDecideAdmissions = (role) => normalizeRole(role) === 'admissions_officer';

export const isReadOnlyAdmissions = (role) => normalizeRole(role) === 'registrar';

export const rolesForKind = (_kind) => STAFF_ROLES;

export const staffHome = (role, modules = []) => {
  const key = normalizeRole(role);
  const base = portalPathForRole(key);
  if (key === 'teacher') return `${FACULTY_BASE}/timetable`;
  if (key === 'registrar' || key === 'admissions_officer') {
    return modules.includes('admissions') ? `${ADMISSIONS_PORTAL_BASE}/admissions` : `${ADMISSIONS_PORTAL_BASE}/password`;
  }
  if (key === 'hr_manager') {
    if (modules.includes('careers')) return `${HR_PORTAL_BASE}/careers`;
    if (modules.includes('staff-attendance')) return `${HR_PORTAL_BASE}/attendance`;
    return `${HR_PORTAL_BASE}/password`;
  }
  if (key === 'accountant') return `${FINANCE_PORTAL_BASE}/home`;
  if (key === 'exam_controller') return `${EXAMS_PORTAL_BASE}/home`;
  if (key === 'librarian') return `${LIBRARY_PORTAL_BASE}/home`;
  return `${base}/password`;
};

export const PORTAL_META = {
  faculty: { base: FACULTY_BASE, title: 'Faculty portal', subtitle: 'Teaching staff sign in' },
  admissions: { base: ADMISSIONS_PORTAL_BASE, title: 'Admissions portal', subtitle: 'Registrar and admissions team' },
  hr: { base: HR_PORTAL_BASE, title: 'HR portal', subtitle: 'Human resources and careers' },
  finance: { base: FINANCE_PORTAL_BASE, title: 'Finance portal', subtitle: 'Fees and campus accounts' },
  exams: { base: EXAMS_PORTAL_BASE, title: 'Exams portal', subtitle: 'Exam cell and results' },
  library: { base: LIBRARY_PORTAL_BASE, title: 'Library portal', subtitle: 'Library operations' },
};
