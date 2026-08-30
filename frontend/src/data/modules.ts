import { ADMIN_BASE } from '../admin/paths';

/** Org-admin sidebar only — operational work lives in staff portals. */
export const MODULE_NAV = {
  admissions: [
    { to: 'admissions', label: 'Admissions settings' },
    { to: 'admissions/form', label: 'Application form' },
  ],
  faculty: [
    { to: 'users', label: 'Staff users' },
    { to: 'access', label: 'Access control' },
    { to: 'classes', label: 'Classes' },
    { to: 'timetable', label: 'Timetable' },
  ],
  'student-attendance': [
    { to: 'attendance/students', label: 'Student attendance' },
    { to: 'attendance/insights', label: 'Attendance insights' },
  ],
};

const MODULE_ORDER = ['admissions', 'faculty', 'student-attendance'];

const CORE_NAV = [
  { to: `${ADMIN_BASE}/dashboard`, label: 'Dashboard' },
  { to: `${ADMIN_BASE}/portals`, label: 'Team portals' },
];

const CAMPUS_NAV = [
  { to: `${ADMIN_BASE}/units`, label: 'Departments' },
  { to: `${ADMIN_BASE}/brand`, label: 'Brand' },
];

const ACCOUNT_NAV = [{ to: `${ADMIN_BASE}/settings`, label: 'Password' }];

export const orgAdminNav = (modules = []) => {
  const items = [...CORE_NAV];
  for (const slug of MODULE_ORDER) {
    if (!modules.includes(slug)) continue;
    for (const item of MODULE_NAV[slug] || []) {
      items.push({ to: `${ADMIN_BASE}/${item.to}`, label: item.label, slug });
    }
  }
  items.push(...CAMPUS_NAV, ...ACCOUNT_NAV);
  return items;
};

export const orgAdminNavGroups = (modules = []) => {
  const flat = orgAdminNav(modules);
  const pick = (labels: string[]) => flat.filter((item) => labels.includes(item.label));

  const groups = [
    { title: 'Overview', items: pick(['Dashboard', 'Team portals']) },
    {
      title: 'People & structure',
      items: pick(['Staff users', 'Access control', 'Classes', 'Timetable']),
    },
    {
      title: 'Admissions setup',
      items: pick(['Admissions settings', 'Application form']),
    },
    {
      title: 'Campus oversight',
      items: pick(['Student attendance', 'Attendance insights']),
    },
    { title: 'Campus', items: pick(['Departments', 'Brand']) },
    { title: 'Account', items: pick(['Password']) },
  ];

  return groups.filter((group) => group.items.length > 0);
};
