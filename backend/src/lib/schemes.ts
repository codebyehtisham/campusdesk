import { prisma } from '../config/db.js';
import { toSlug } from './tenant.js';

export type SchemeSlug = 'education';

export type OrgScheme = {
  slug: SchemeSlug;
  label: string;
  hint: string;
  departments: string[];
  modules: string[];
  units: { name: string; slug: string; description: string }[];
  staffTitles: string[];
  rosterTitles: string[];
  rosterLabels: { student: string; staff: string };
  portalRoles: string[];
};

export const ORG_KINDS = ['education'] as const;

export const EDUCATION_SCHEME: OrgScheme = {
  slug: 'education',
  label: 'Education institute',
  hint: 'Colleges, schools, and training campuses. Administration, faculty, students, and campus operations.',
  departments: [
    'student-intake',
    'academic-staff',
    'academic-operations',
    'campus-attendance',
    'human-resources',
    'finance-fees',
    'library-services',
    'compliance-records',
    'campus-assets',
  ],
  modules: [
    'admissions',
    'faculty',
    'timetable',
    'student-attendance',
    'staff-attendance',
    'careers',
    'hr-payroll',
    'fees',
    'examinations',
    'library',
    'compliance-vault',
    'inventory',
  ],
  units: [
    { name: 'Administration', slug: 'administration', description: 'Campus leadership and office staff.' },
    { name: 'Faculty', slug: 'faculty', description: 'Teaching staff and academic leads.' },
    { name: 'Academics', slug: 'academics', description: 'Classes, programmes, and students.' },
    { name: 'Admissions', slug: 'admissions', description: 'Intake and enrolment desk.' },
    { name: 'Accounts', slug: 'accounts', description: 'Fees and campus accounts.' },
    { name: 'Library', slug: 'library', description: 'Learning resources.' },
    { name: 'Examinations', slug: 'examinations', description: 'Exam cell and result processing.' },
  ],
  staffTitles: ['Faculty', 'Administrator', 'Accountant', 'Clerk', 'Librarian', 'Lab technician', 'Other'],
  rosterTitles: ['Generic Nursing (BSN)', 'Post-RN BSN', 'Midwifery', 'Other'],
  rosterLabels: { student: 'Students', staff: 'Staff' },
  portalRoles: [
    'teacher',
    'registrar',
    'admissions_officer',
    'hr_manager',
    'accountant',
    'exam_controller',
    'librarian',
  ],
};

export const ORG_SCHEMES: Record<SchemeSlug, OrgScheme> = {
  education: EDUCATION_SCHEME,
};

export const parseOrgKind = (_value: unknown) => 'education' as const;

export const getScheme = (_kind?: unknown): OrgScheme => EDUCATION_SCHEME;

export const publicSchemes = () => {
  const item = EDUCATION_SCHEME;
  return [
    {
      slug: item.slug,
      label: item.label,
      hint: item.hint,
      departments: item.departments,
      modules: item.modules,
      units: item.units,
      staffTitles: item.staffTitles,
      rosterTitles: item.rosterTitles,
      rosterLabels: item.rosterLabels,
      portalRoles: item.portalRoles,
    },
  ];
};

export const seedOrgUnits = async (organizationId: string, _kind?: unknown) => {
  const scheme = getScheme();
  const existing = await prisma.orgUnit.count({ where: { organizationId } });
  if (existing > 0) return;
  await prisma.orgUnit.createMany({
    data: scheme.units.map((unit, index) => ({
      organizationId,
      name: unit.name,
      slug: toSlug(unit.slug || unit.name),
      description: unit.description,
      sortOrder: index + 1,
    })),
  });
};
