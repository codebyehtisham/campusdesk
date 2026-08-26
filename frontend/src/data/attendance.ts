export const STAFF_TITLES = ['Faculty', 'Administrator', 'Accountant', 'Clerk', 'Librarian', 'Lab technician', 'Other'];

export const STUDENT_PROGRAMMES = ['Generic Nursing (BSN)', 'Post-RN BSN', 'Midwifery', 'Other'];

export const ATTENDANCE_STATUSES = [
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'late', label: 'Late' },
  { key: 'leave', label: 'Leave' },
];

export const todayStamp = () => new Date().toISOString().slice(0, 10);
