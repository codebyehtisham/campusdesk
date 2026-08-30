import {
  ADMISSIONS_PORTAL_BASE,
  ADMIN_BASE,
  EXAMS_PORTAL_BASE,
  FACULTY_BASE,
  FINANCE_PORTAL_BASE,
  HR_PORTAL_BASE,
  LIBRARY_PORTAL_BASE,
} from '../admin/paths';

/** Screens that stay in the org admin console. */
export const ORG_ADMIN_SCREENS = [
  {
    key: 'users',
    label: 'Staff users',
    to: `${ADMIN_BASE}/users`,
    modules: ['faculty'],
    group: 'People & structure',
    description: 'Create accounts, assign roles, and link staff to the right portal.',
  },
  {
    key: 'access',
    label: 'Access control',
    to: `${ADMIN_BASE}/access`,
    modules: ['faculty'],
    group: 'People & structure',
    description: 'Block accounts and reset passwords.',
  },
  {
    key: 'classes',
    label: 'Classes',
    to: `${ADMIN_BASE}/classes`,
    modules: ['faculty'],
    group: 'People & structure',
    description: 'Set up class sections, teachers, and enrolled students.',
  },
  {
    key: 'timetable',
    label: 'Timetable',
    to: `${ADMIN_BASE}/timetable`,
    modules: ['faculty'],
    group: 'People & structure',
    description: 'Build the weekly teaching schedule.',
  },
  {
    key: 'admissions',
    label: 'Admissions settings',
    to: `${ADMIN_BASE}/admissions`,
    modules: ['admissions'],
    group: 'Admissions setup',
    description: 'Open or close applications and monitor the pipeline.',
  },
  {
    key: 'admissions-form',
    label: 'Application form',
    to: `${ADMIN_BASE}/admissions/form`,
    modules: ['admissions'],
    group: 'Admissions setup',
    description: 'Configure fields applicants fill in.',
  },
  {
    key: 'attendance-students',
    label: 'Student attendance',
    to: `${ADMIN_BASE}/attendance/students`,
    modules: ['student-attendance'],
    group: 'Campus oversight',
    description: 'Daily student register and roster management.',
  },
  {
    key: 'attendance-insights',
    label: 'Attendance insights',
    to: `${ADMIN_BASE}/attendance/insights`,
    modules: ['student-attendance'],
    group: 'Campus oversight',
    description: 'Class and student attendance analytics.',
  },
  {
    key: 'units',
    label: 'Departments',
    to: `${ADMIN_BASE}/units`,
    modules: [],
    group: 'Campus',
    description: 'Organise schools, faculties, and units.',
  },
  {
    key: 'brand',
    label: 'Brand',
    to: `${ADMIN_BASE}/brand`,
    modules: [],
    group: 'Campus',
    description: 'Campus name, logo, and public identity.',
  },
];

/** Operational work delegated to staff portals. */
export const DELEGATED_PORTALS = [
  {
    key: 'faculty',
    label: 'Faculty portal',
    path: FACULTY_BASE,
    audience: 'Teachers',
    roles: ['teacher'],
    modules: ['faculty'],
    owns: ['Daily teaching', 'Course content', 'Session attendance', 'Leave requests'],
  },
  {
    key: 'admissions',
    label: 'Admissions portal',
    path: ADMISSIONS_PORTAL_BASE,
    audience: 'Registrar & admissions team',
    roles: ['registrar', 'admissions_officer'],
    modules: ['admissions'],
    owns: ['Application review', 'Accept / reject decisions'],
  },
  {
    key: 'hr',
    label: 'HR portal',
    path: HR_PORTAL_BASE,
    audience: 'HR managers',
    roles: ['hr_manager'],
    modules: ['careers', 'staff-attendance', 'hr-payroll'],
    owns: ['Job openings', 'Leave allowances & approvals', 'Staff attendance', 'Attendance calendar'],
  },
  {
    key: 'finance',
    label: 'Finance portal',
    path: FINANCE_PORTAL_BASE,
    audience: 'Accountants',
    roles: ['accountant'],
    modules: ['fees'],
    owns: ['Fee plans', 'Student fees', 'Payment recording'],
  },
  {
    key: 'exams',
    label: 'Exams portal',
    path: EXAMS_PORTAL_BASE,
    audience: 'Exam controllers',
    roles: ['exam_controller'],
    modules: ['examinations'],
    owns: ['Exam schedules', 'Mark entry', 'Result cards'],
  },
  {
    key: 'library',
    label: 'Library portal',
    path: LIBRARY_PORTAL_BASE,
    audience: 'Librarians',
    roles: ['librarian'],
    modules: ['library'],
    owns: ['Catalog', 'Issue books', 'Loans & returns'],
  },
];

const hasAnyModule = (modules: string[], required: string[]) =>
  !required.length || required.some((slug) => modules.includes(slug));

export const adminScreensForOrg = (modules: string[] = []) =>
  ORG_ADMIN_SCREENS.filter((screen) => hasAnyModule(modules, screen.modules));

export const delegatedPortalsForOrg = (modules: string[] = []) =>
  DELEGATED_PORTALS.filter((portal) => hasAnyModule(modules, portal.modules));
