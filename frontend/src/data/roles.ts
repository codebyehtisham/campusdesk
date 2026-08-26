import { FACULTY_BASE } from '../admin/paths';

export const FACULTY_ROLES = [
  {
    key: 'reader',
    label: 'Reader',
    hint: 'Can open student applications. Cannot accept or reject.',
  },
  {
    key: 'officer',
    label: 'Officer',
    hint: 'Can accept, reject, and change admission decisions.',
  },
  {
    key: 'teacher',
    label: 'Faculty member',
    hint: 'Teaches assigned classes. Can open a QR session and mark student attendance from the timetable.',
  },
];

const aliases = {
  viewer: 'reader',
  reviewer: 'officer',
};

export const normalizeRole = (role) => aliases[role] || role;

export const roleLabel = (role, kind) => {
  const key = normalizeRole(role);
  if (key === 'admin') return 'Administrator';
  return rolesForKind(kind).find((item) => item.key === key)?.label || role;
};

export const isTeacher = (role) => normalizeRole(role) === 'teacher';

export const canDecideAdmissions = (role) => {
  const key = normalizeRole(role);
  return key === 'officer';
};

export const isReadOnlyAdmissions = (role) => normalizeRole(role) === 'reader';

export const rolesForKind = (kind) => {
  if (kind === 'hospital') {
    return [
      {
        key: 'reader',
        label: 'Staff user',
        hint: 'Can sign in to the staff portal. Access follows the modules this hospital pays for.',
      },
      {
        key: 'officer',
        label: 'HR / officer',
        hint: 'Can manage HR records and other enabled hospital services.',
      },
    ];
  }
  return FACULTY_ROLES;
};

export const staffHome = (role, modules = []) => {
  if (isTeacher(role)) return `${FACULTY_BASE}/timetable`;
  if (modules.includes('admissions')) return `${FACULTY_BASE}/admissions`;
  return `${FACULTY_BASE}/password`;
};
