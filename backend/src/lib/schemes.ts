import type { OrgKind } from '@prisma/client';
import { prisma } from '../config/db.js';
import { toSlug } from './tenant.js';

export const ORG_KINDS = ['education', 'hospital'] as const;

export type SchemeSlug = (typeof ORG_KINDS)[number];

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

export const ORG_SCHEMES: Record<SchemeSlug, OrgScheme> = {
  education: {
    slug: 'education',
    label: 'Education institute',
    hint: 'Colleges, schools, and training campuses. Administration, faculty members, and student users.',
    departments: ['student-intake', 'academic-staff', 'campus-attendance', 'human-resources'],
    modules: ['admissions', 'faculty', 'student-attendance', 'staff-attendance', 'careers'],
    units: [
      { name: 'Administration', slug: 'administration', description: 'Campus leadership and office staff.' },
      { name: 'Faculty', slug: 'faculty', description: 'Teaching staff and academic leads.' },
      { name: 'Academics', slug: 'academics', description: 'Classes, programmes, and students.' },
      { name: 'Admissions', slug: 'admissions', description: 'Intake and enrolment desk.' },
      { name: 'Accounts', slug: 'accounts', description: 'Fees and campus accounts.' },
      { name: 'Library', slug: 'library', description: 'Learning resources.' },
    ],
    staffTitles: ['Faculty', 'Administrator', 'Accountant', 'Clerk', 'Librarian', 'Lab technician', 'Other'],
    rosterTitles: ['Generic Nursing (BSN)', 'Post-RN BSN', 'Midwifery', 'Other'],
    rosterLabels: { student: 'Students', staff: 'Staff' },
    portalRoles: ['reader', 'officer', 'teacher'],
  },
  hospital: {
    slug: 'hospital',
    label: 'Hospital',
    hint: 'Hospitals and clinics. HR, radiology, laboratory, and other clinical departments.',
    departments: ['human-resources', 'campus-attendance', 'academic-staff'],
    modules: ['careers', 'staff-attendance', 'faculty'],
    units: [
      { name: 'Administration', slug: 'administration', description: 'Hospital management and office staff.' },
      { name: 'Human Resources', slug: 'human-resources', description: 'Recruitment, duty rosters, and HR files.' },
      { name: 'Radiology', slug: 'radiology', description: 'X-ray, CT, MRI, and imaging.' },
      { name: 'Laboratory', slug: 'laboratory', description: 'Pathology and diagnostics.' },
      { name: 'Emergency', slug: 'emergency', description: 'Accident and emergency.' },
      { name: 'Outpatient', slug: 'outpatient', description: 'OPD clinics.' },
      { name: 'Inpatient', slug: 'inpatient', description: 'Wards and admitted patients.' },
      { name: 'Pharmacy', slug: 'pharmacy', description: 'Dispensing and stores.' },
      { name: 'Nursing', slug: 'nursing', description: 'Nursing services.' },
      { name: 'Cardiology', slug: 'cardiology', description: 'Cardiac care.' },
      { name: 'Finance', slug: 'finance', description: 'Billing and accounts.' },
    ],
    staffTitles: ['HR officer', 'Radiologist', 'Lab technician', 'Nurse', 'Pharmacist', 'Administrator', 'Clerk', 'Consultant', 'Other'],
    rosterTitles: ['Inpatient', 'Outpatient', 'Emergency', 'Other'],
    rosterLabels: { student: 'Patients', staff: 'Staff' },
    portalRoles: ['reader', 'officer'],
  },
};

export const parseOrgKind = (value: unknown): OrgKind =>
  value === 'hospital' ? 'hospital' : 'education';

export const getScheme = (kind: unknown): OrgScheme => ORG_SCHEMES[parseOrgKind(kind)];

export const publicSchemes = () =>
  ORG_KINDS.map((slug) => {
    const item = ORG_SCHEMES[slug];
    return {
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
    };
  });

export const seedOrgUnits = async (organizationId: string, kind: unknown) => {
  const scheme = getScheme(kind);
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
