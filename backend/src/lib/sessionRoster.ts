import { prisma } from '../config/db.js';
import { getSiteSettings } from '../controllers/settingsController.js';
import {
  attendancePercent,
  computeFinalPresent,
  locationStatusFromMark,
  qrStatusFromMark,
  type AttendanceHistoryPoint,
} from './attendanceRules.js';

const toLocation = (mark: {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  onCampus: boolean | null;
  distanceMeters: number | null;
}) =>
  mark.latitude != null && mark.longitude != null
    ? {
        latitude: mark.latitude,
        longitude: mark.longitude,
        accuracy: mark.accuracy,
        onCampus: mark.onCampus,
        distanceMeters: mark.distanceMeters,
      }
    : null;

export const loadClassAttendanceHistories = async (
  classId: string,
  locationEnabled: boolean,
  personIds: string[]
) => {
  const histories = new Map<string, AttendanceHistoryPoint[]>();
  for (const personId of personIds) histories.set(personId, []);

  if (!personIds.length) return histories;

  const sessions = await prisma.attendanceSession.findMany({
    where: { classId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { marks: true },
    take: 90,
  });

  for (const session of sessions) {
    const date = session.date.toISOString().slice(0, 10);
    const byPerson = new Map(session.marks.map((mark) => [mark.personId, mark]));
    for (const personId of personIds) {
      const mark = byPerson.get(personId);
      const qr = qrStatusFromMark(mark?.status ?? null);
      const location = locationStatusFromMark(locationEnabled, mark ?? null);
      histories.get(personId)!.push({
        date,
        finalPresent: computeFinalPresent(locationEnabled, qr, location),
      });
    }
  }

  return histories;
};

export const buildSessionRoster = async (classId: string, sessionId: string, organizationId: string) => {
  const settings = await getSiteSettings(organizationId);
  const locationEnabled = Boolean(settings?.attendanceLocationEnabled);

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, person: { active: true } },
    include: { person: { select: { id: true, name: true, title: true, email: true } } },
    orderBy: { person: { name: 'asc' } },
  });
  const marks = await prisma.sessionAttendance.findMany({ where: { sessionId } });
  const byPerson = new Map(marks.map((item) => [item.personId, item]));
  const personIds = enrollments.map((item) => item.person.id);
  const histories = await loadClassAttendanceHistories(classId, locationEnabled, personIds);

  return enrollments.map((item) => {
    const mark = byPerson.get(item.person.id);
    const qrStatus = qrStatusFromMark(mark?.status ?? null);
    const locationStatus = locationStatusFromMark(locationEnabled, mark ?? null);
    const history = histories.get(item.person.id) || [];
    return {
      id: item.person.id,
      name: item.person.name,
      title: item.person.title,
      email: item.person.email,
      status: mark?.status || null,
      qrStatus,
      locationStatus,
      finalPresent: computeFinalPresent(locationEnabled, qrStatus, locationStatus),
      location: mark ? toLocation(mark) : null,
      attendanceHistory: history,
      attendancePercent: attendancePercent(history),
    };
  });
};

export const sessionAttendanceFlags = async (organizationId: string) => {
  const settings = await getSiteSettings(organizationId);
  return { attendanceLocationEnabled: Boolean(settings?.attendanceLocationEnabled) };
};
