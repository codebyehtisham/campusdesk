import type { AttendanceStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { getSiteSettings } from '../controllers/settingsController.js';
import {
  attendancePercent,
  computeFinalPresent,
  locationStatusFromMark,
  qrStatusFromMark,
} from './attendanceRules.js';
import { buildSessionRoster, loadClassAttendanceHistories } from './sessionRoster.js';

const dayStart = (value: unknown) => {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const [year, month, day] = raw.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const finalPresentForMark = (
  locationEnabled: boolean,
  mark?: { status: AttendanceStatus | null; onCampus?: boolean | null; latitude?: number | null } | null
) => {
  const qr = qrStatusFromMark(mark?.status ?? null);
  const location = locationStatusFromMark(locationEnabled, mark ?? null);
  return computeFinalPresent(locationEnabled, qr, location);
};

export const loadLocationEnabled = async (organizationId: string) => {
  const settings = await getSiteSettings(organizationId);
  return Boolean(settings?.attendanceLocationEnabled);
};

export const analyticsMeta = async (organizationId: string) => {
  const [classes, students] = await Promise.all([
    prisma.classSection.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.attendancePerson.findMany({
      where: { organizationId, kind: 'student', active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, title: true, email: true },
    }),
  ]);
  return { classes, students };
};

export const analyticsByClassDate = async (organizationId: string, dateRaw: unknown) => {
  const date = dayStart(dateRaw);
  const locationEnabled = await loadLocationEnabled(organizationId);
  const sessions = await prisma.attendanceSession.findMany({
    where: { organizationId, date },
    orderBy: { createdAt: 'asc' },
    include: {
      class: { select: { id: true, name: true, code: true } },
      teacher: { select: { name: true, email: true } },
    },
  });

  const classes = await Promise.all(
    sessions.map(async (session) => {
      const roster = await buildSessionRoster(session.classId, session.id, organizationId);
      const enrolled = roster.length;
      const present = roster.filter((row) => row.finalPresent).length;
      return {
        sessionId: session.id,
        classId: session.classId,
        className: session.class.name,
        classCode: session.class.code,
        teacherName: session.teacher.name || session.teacher.email,
        enrolled,
        present,
        percent: enrolled ? Math.round((present / enrolled) * 100) : 0,
        status: session.status,
      };
    })
  );

  return {
    date: date.toISOString().slice(0, 10),
    attendanceLocationEnabled: locationEnabled,
    classes,
  };
};

export const analyticsStudent = async (organizationId: string, personId: string, classId?: string) => {
  const locationEnabled = await loadLocationEnabled(organizationId);
  const person = await prisma.attendancePerson.findFirst({
    where: { id: personId, organizationId, kind: 'student' },
    select: { id: true, name: true, title: true, email: true },
  });
  if (!person) return null;

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      personId,
      ...(classId ? { classId } : {}),
      class: { organizationId },
    },
    include: { class: { select: { id: true, name: true, code: true } } },
  });
  const classIds = enrollments.map((row) => row.classId);
  if (!classIds.length) {
    return {
      student: person,
      attendanceLocationEnabled: locationEnabled,
      history: [],
      percent: 0,
      classes: [],
    };
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: { organizationId, classId: { in: classIds } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: {
      marks: { where: { personId } },
      class: { select: { id: true, name: true, code: true } },
    },
  });

  const history = sessions.map((session) => {
    const mark = session.marks[0];
    return {
      date: session.date.toISOString().slice(0, 10),
      classId: session.classId,
      className: session.class.name,
      finalPresent: finalPresentForMark(locationEnabled, mark),
    };
  });

  return {
    student: person,
    attendanceLocationEnabled: locationEnabled,
    history,
    percent: attendancePercent(history.map((row) => ({ date: row.date, finalPresent: row.finalPresent }))),
    classes: enrollments.map((row) => row.class),
  };
};

export const analyticsClassOverall = async (organizationId: string, classId: string) => {
  const locationEnabled = await loadLocationEnabled(organizationId);
  const section = await prisma.classSection.findFirst({
    where: { id: classId, organizationId },
    select: { id: true, name: true, code: true },
  });
  if (!section) return null;

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, person: { active: true } },
    include: { person: { select: { id: true, name: true, title: true, email: true } } },
    orderBy: { person: { name: 'asc' } },
  });
  const personIds = enrollments.map((row) => row.personId);

  const sessions = await prisma.attendanceSession.findMany({
    where: { organizationId, classId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { teacher: { select: { name: true, email: true } } },
  });

  const timeline = await Promise.all(
    sessions.map(async (session) => {
      const roster = await buildSessionRoster(classId, session.id, organizationId);
      const enrolled = roster.length;
      const present = roster.filter((row) => row.finalPresent).length;
      return {
        date: session.date.toISOString().slice(0, 10),
        sessionId: session.id,
        teacherName: session.teacher.name || session.teacher.email,
        enrolled,
        present,
        percent: enrolled ? Math.round((present / enrolled) * 100) : 0,
      };
    })
  );

  const histories = await loadClassAttendanceHistories(classId, locationEnabled, personIds);
  const students = enrollments.map((row) => {
    const history = histories.get(row.person.id) || [];
    return {
      id: row.person.id,
      name: row.person.name,
      title: row.person.title,
      email: row.person.email,
      percent: attendancePercent(history),
      history,
    };
  });

  const overallPercent = students.length
    ? Math.round(students.reduce((sum, row) => sum + row.percent, 0) / students.length)
    : 0;

  return {
    class: section,
    attendanceLocationEnabled: locationEnabled,
    timeline,
    students,
    overallPercent,
  };
};
