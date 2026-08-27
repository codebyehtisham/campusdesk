import type { AttendanceStatus } from '@prisma/client';

export type QrStatus = 'present' | 'absent' | 'na';
export type LocationStatus = 'onsite' | 'offsite' | 'unknown';

export type AttendanceMarkLike = {
  status?: AttendanceStatus | null;
  onCampus?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type AttendanceHistoryPoint = {
  date: string;
  finalPresent: boolean;
};

export const qrStatusFromMark = (status: AttendanceStatus | null | undefined): QrStatus => {
  if (!status) return 'na';
  if (status === 'present') return 'present';
  return 'absent';
};

export const locationStatusFromMark = (
  locationEnabled: boolean,
  mark: AttendanceMarkLike | null | undefined
): LocationStatus | null => {
  if (!locationEnabled) return null;
  if (!mark) return 'unknown';
  if (mark.onCampus === true) return 'onsite';
  if (mark.onCampus === false) return 'offsite';
  return 'unknown';
};

export const computeFinalPresent = (
  locationEnabled: boolean,
  qr: QrStatus,
  location: LocationStatus | null
): boolean => {
  if (qr !== 'present') return false;
  if (!locationEnabled) return true;
  return location === 'onsite';
};

export const attendancePercent = (history: AttendanceHistoryPoint[]) => {
  if (!history.length) return 0;
  const hits = history.filter((row) => row.finalPresent).length;
  return Math.round((hits / history.length) * 100);
};
