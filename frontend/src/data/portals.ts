import {
  ADMISSIONS_PORTAL_BASE,
  EXAMS_PORTAL_BASE,
  FACULTY_BASE,
  FINANCE_PORTAL_BASE,
  HR_PORTAL_BASE,
  LIBRARY_PORTAL_BASE,
  ORG_ADMIN_BASE,
} from '../admin/paths';
import { STAFF_ROLES } from './roles';

export const INSTITUTE_PORTALS = [
  { key: 'admin', label: 'Org admin', path: ORG_ADMIN_BASE, audience: 'Campus administrators' },
  { key: 'faculty', label: 'Faculty portal', path: FACULTY_BASE, audience: 'Teachers' },
  { key: 'admissions', label: 'Admissions portal', path: ADMISSIONS_PORTAL_BASE, audience: 'Registrar & admissions team' },
  { key: 'hr', label: 'HR portal', path: HR_PORTAL_BASE, audience: 'HR managers' },
  { key: 'finance', label: 'Finance portal', path: FINANCE_PORTAL_BASE, audience: 'Accountants' },
  { key: 'exams', label: 'Exams portal', path: EXAMS_PORTAL_BASE, audience: 'Exam controllers' },
  { key: 'library', label: 'Library portal', path: LIBRARY_PORTAL_BASE, audience: 'Librarians' },
  { key: 'apply', label: 'Student apply', path: '/apply', audience: 'Prospective students' },
  { key: 'student', label: 'Student login', path: '/login', audience: 'Accepted students' },
];

export const STAFF_PORTAL_ROLES = STAFF_ROLES.map((role) => ({
  role: role.key,
  label: role.label,
  portalLabel: role.portalLabel,
  path: role.portalPath,
  hint: role.hint,
}));

export const portalSignInSummary = () =>
  [
    `Org admin ${ORG_ADMIN_BASE}`,
    `Faculty ${FACULTY_BASE}`,
    `Admissions ${ADMISSIONS_PORTAL_BASE}`,
    `HR ${HR_PORTAL_BASE}`,
    `Finance ${FINANCE_PORTAL_BASE}`,
    `Exams ${EXAMS_PORTAL_BASE}`,
    `Library ${LIBRARY_PORTAL_BASE}`,
    `Students /apply`,
  ].join(' · ');
