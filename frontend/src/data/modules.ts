import { ADMIN_BASE } from '../admin/paths';

export const MODULE_NAV = {
  admissions: [
    { to: 'admissions', label: 'Admissions' },
    { to: 'admissions/form', label: 'Admission portal' },
  ],
  faculty: [
    { to: 'users', label: 'Users' },
    { to: 'access', label: 'Access' },
    { to: 'classes', label: 'Classes' },
    { to: 'timetable', label: 'Timetable' },
  ],
  careers: [{ to: 'careers', label: 'HR' }],
  'hr-payroll': [{ to: 'careers', label: 'HR & payroll' }],
  'student-attendance': [
    { to: 'attendance/students', label: 'Student attendance' },
    { to: 'attendance/insights', label: 'Attendance insights' },
  ],
  'staff-attendance': [{ to: 'attendance/staff', label: 'Staff attendance' }],
  timetable: [{ to: 'timetable', label: 'Timetable' }],
  fees: [{ to: 'dashboard', label: 'Fees & finance' }],
  examinations: [{ to: 'dashboard', label: 'Examinations' }],
  library: [{ to: 'dashboard', label: 'Library' }],
  'compliance-vault': [{ to: 'dashboard', label: 'Compliance vault' }],
  inventory: [{ to: 'dashboard', label: 'Inventory' }],
};

const MODULE_ORDER = [
  'admissions',
  'faculty',
  'timetable',
  'examinations',
  'fees',
  'careers',
  'hr-payroll',
  'student-attendance',
  'staff-attendance',
  'library',
  'compliance-vault',
  'inventory',
];

export const orgAdminNav = (modules = []) => {
  const items = [{ to: `${ADMIN_BASE}/dashboard`, label: 'Dashboard' }];
  for (const slug of MODULE_ORDER) {
    if (!modules.includes(slug)) continue;
    for (const item of MODULE_NAV[slug] || []) {
      items.push({ to: `${ADMIN_BASE}/${item.to}`, label: item.label, slug });
    }
  }
  items.push({ to: `${ADMIN_BASE}/units`, label: 'Departments' });
  items.push({ to: `${ADMIN_BASE}/brand`, label: 'Brand' });
  items.push({ to: `${ADMIN_BASE}/settings`, label: 'Password' });
  return items;
};

export const orgAdminNavGroups = (modules = []) => {
  const flat = orgAdminNav(modules);
  const bySuffix = (suffix: string) => flat.filter((item) => item.to.endsWith(`/${suffix}`) || item.to.endsWith(suffix));
  const byLabels = (labels: string[]) => flat.filter((item) => labels.includes(item.label));

  const groups = [
    { title: 'Overview', items: bySuffix('dashboard') },
    {
      title: 'Operations',
      items: byLabels([
        'Admissions',
        'Admission portal',
        'HR',
        'HR & payroll',
        'Student attendance',
        'Attendance insights',
        'Staff attendance',
        'Fees & finance',
        'Examinations',
        'Library',
        'Compliance vault',
        'Inventory',
      ]),
    },
    { title: 'Teaching', items: byLabels(['Users', 'Access', 'Classes', 'Timetable']) },
    { title: 'Campus', items: [...bySuffix('units'), ...bySuffix('brand')] },
    { title: 'Account', items: bySuffix('settings') },
  ];

  return groups.filter((group) => group.items.length > 0);
};
