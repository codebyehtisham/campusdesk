import type { LeaveStatus, LeaveType } from '@prisma/client';

export const LEAVE_TYPES: LeaveType[] = ['sick', 'casual', 'maternity', 'annual'];

export const parseLeaveType = (value: unknown): LeaveType | null => {
  const type = String(value || '').trim() as LeaveType;
  return LEAVE_TYPES.includes(type) ? type : null;
};

export const parseDay = (value: unknown) => {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const leaveDayCount = (start: Date, end: Date) => {
  const cursor = new Date(start);
  let days = 0;
  while (cursor <= end) {
    days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

export const gradeFor = (marks: number | null, max: number) => {
  if (marks == null || max <= 0) return '';
  const pct = (marks / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
};

export const toStudentLeave = (row: {
  id: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  reviewNotes: string;
  reviewedAt: Date | null;
  createdAt: Date;
  class?: { id: string; name: string; code: string };
  teacher?: { id: string; name: string };
}) => ({
  id: row.id,
  type: row.type,
  startDate: row.startDate.toISOString().slice(0, 10),
  endDate: row.endDate.toISOString().slice(0, 10),
  reason: row.reason,
  status: row.status,
  reviewNotes: row.reviewNotes,
  reviewedAt: row.reviewedAt,
  createdAt: row.createdAt,
  class: row.class ? { id: row.class.id, name: row.class.name, code: row.class.code } : undefined,
  teacher: row.teacher ? { id: row.teacher.id, name: row.teacher.name } : undefined,
});
