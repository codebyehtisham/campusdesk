import { ADMIN_BASE } from '../admin/paths';

export const MODULE_NAV = {
  admissions: [{ to: 'admissions', label: 'Admissions' }],
  faculty: [
    { to: 'users', label: 'Users' },
    { to: 'access', label: 'Access' },
    { to: 'classes', label: 'Classes' },
    { to: 'timetable', label: 'Timetable' },
  ],
  careers: [{ to: 'careers', label: 'HR' }],
  'student-attendance': [
    { to: 'attendance/students', label: 'Student attendance' },
    { to: 'attendance/insights', label: 'Attendance insights' },
  ],
  'staff-attendance': [{ to: 'attendance/staff', label: 'Staff attendance' }],
};

export const orgAdminNav = (modules = [], kind = 'education') => {
  const items = [{ to: `${ADMIN_BASE}/dashboard`, label: 'Dashboard' }];
  for (const slug of ['admissions', 'faculty', 'careers', 'student-attendance', 'staff-attendance']) {
    if (!modules.includes(slug)) continue;
    for (const item of MODULE_NAV[slug] || []) {
      if (kind === 'hospital' && (item.to === 'classes' || item.to === 'timetable')) continue;
      if (kind === 'hospital' && item.to === 'attendance/students') {
        items.push({ to: `${ADMIN_BASE}/${item.to}`, label: 'Patient register', slug });
        continue;
      }
      items.push({ to: `${ADMIN_BASE}/${item.to}`, label: item.label, slug });
    }
  }
  items.push({ to: `${ADMIN_BASE}/units`, label: 'Departments' });
  items.push({ to: `${ADMIN_BASE}/brand`, label: 'Brand' });
  items.push({ to: `${ADMIN_BASE}/settings`, label: 'Password' });
  return items;
};

export const orgAdminNavGroups = (modules = [], kind = 'education') => {
  const flat = orgAdminNav(modules, kind);
  const bySuffix = (suffix: string) => flat.filter((item) => item.to.endsWith(`/${suffix}`) || item.to.endsWith(suffix));
  const byLabels = (labels: string[]) => flat.filter((item) => labels.includes(item.label));

  const groups = [
    { title: 'Overview', items: bySuffix('dashboard') },
    {
      title: 'Operations',
      items: byLabels(['Admissions', 'HR', 'Student attendance', 'Attendance insights', 'Staff attendance', 'Patient register']),
    },
    { title: 'Teaching', items: byLabels(['Users', 'Access', 'Classes', 'Timetable']) },
    { title: 'Campus', items: [...bySuffix('units'), ...bySuffix('brand')] },
    { title: 'Account', items: bySuffix('settings') },
  ];

  return groups.filter((group) => group.items.length > 0);
};
