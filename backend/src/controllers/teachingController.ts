import type { AttendanceStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { evaluateFence, parseFence, parseScanLocation } from '../lib/geofence.js';
import { buildSessionRoster, sessionAttendanceFlags } from '../lib/sessionRoster.js';
import { hasModule, orgId } from '../lib/tenant.js';
import { sanitizeTheme } from '../lib/theme.js';
import { getSiteSettings } from './settingsController.js';
import { dayStamp, jsToWeekday, newQrToken, QR_TTL_MS, qrImage, qrPayload } from '../lib/teaching.js';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'leave'];

const parseStatus = (value: unknown): AttendanceStatus => {
  const status = String(value || '') as AttendanceStatus;
  return STATUSES.includes(status) ? status : 'present';
};

const requireOrg = (req: Request, res: Response) => {
  const organizationId = orgId(req);
  if (!organizationId || !req.user) {
    res.status(403).json({ message: 'Account is not linked to an organisation.' });
    return null;
  }
  return { organizationId, teacherId: req.user.id };
};

const ownedClass = (organizationId: string, teacherId: string, classId: string) =>
  prisma.classSection.findFirst({
    where: { id: classId, organizationId, teacherId },
  });

const toContent = (row: { id: string; classId: string; title: string; body: string; week: number; createdAt: Date }) => ({
  id: row.id,
  classId: row.classId,
  title: row.title,
  body: row.body,
  week: row.week,
  createdAt: row.createdAt,
});

const toSlot = (row: {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  class: { name: string; code: string };
}) => ({
  id: row.id,
  classId: row.classId,
  className: row.class.name,
  classCode: row.class.code,
  dayOfWeek: row.dayOfWeek,
  startTime: row.startTime,
  endTime: row.endTime,
  room: row.room,
});

const sessionPayload = async (
  session: {
    id: string;
    classId: string;
    slotId: string | null;
    date: Date;
    qrToken: string;
    qrExpiresAt: Date;
    status: string;
    class: { name: string; code: string; room: string };
  },
  organizationId: string
) => {
  const flags = await sessionAttendanceFlags(organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { theme: true },
  });
  const theme = sanitizeTheme(org?.theme);
  return {
    id: session.id,
    classId: session.classId,
    slotId: session.slotId,
    className: session.class.name,
    classCode: session.class.code,
    room: session.class.room,
    date: session.date.toISOString().slice(0, 10),
    status: session.status,
    qrToken: session.qrToken,
    qrPayload: qrPayload(session.qrToken),
    qrImage: await qrImage(session.qrToken, theme),
    qrExpiresAt: session.qrExpiresAt.toISOString(),
    attendanceLocationEnabled: flags.attendanceLocationEnabled,
    roster: await buildSessionRoster(session.classId, session.id, organizationId),
  };
};

export const getTeaching = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const { organizationId, teacherId } = ctx;
    const today = dayStamp();
    const dayOfWeek = jsToWeekday(new Date());

    const classes = await prisma.classSection.findMany({
      where: { organizationId, teacherId, active: true },
      orderBy: { name: 'asc' },
      include: {
        course: { select: { id: true, title: true, level: true } },
        enrollments: {
          include: { person: { select: { id: true, name: true, title: true, email: true, active: true } } },
          orderBy: { person: { name: 'asc' } },
        },
        contents: { orderBy: [{ week: 'asc' }, { createdAt: 'desc' }] },
        slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });

    const slots = await prisma.timetableSlot.findMany({
      where: { organizationId, OR: [{ teacherId }, { class: { teacherId } }] },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: { class: { select: { name: true, code: true } } },
    });

    res.json({
      today: { date: today.toISOString().slice(0, 10), dayOfWeek },
      canMarkAttendance: hasModule(req.organization, 'student-attendance'),
      classes: classes.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        room: row.room,
        course: row.course,
        studentCount: row.enrollments.length,
        students: row.enrollments.map((item) => item.person),
        contents: row.contents.map(toContent),
        slots: row.slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
        })),
      })),
      slots: slots.map(toSlot),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load teaching desk', error: (err as Error).message });
  }
};

export const createContent = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const section = await ownedClass(ctx.organizationId, ctx.teacherId, req.params.id);
    if (!section) return res.status(404).json({ message: 'Class not found.' });
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'A title is required.' });
    const week = Math.max(0, Number(req.body.week) || 0);
    const created = await prisma.courseContent.create({
      data: {
        organizationId: ctx.organizationId,
        classId: section.id,
        teacherId: ctx.teacherId,
        title,
        body: String(req.body.body || '').trim(),
        week,
      },
    });
    res.status(201).json(toContent(created));
  } catch (err) {
    res.status(400).json({ message: 'Could not save course content.', error: (err as Error).message });
  }
};

export const updateContent = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const existing = await prisma.courseContent.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
    });
    if (!existing) return res.status(404).json({ message: 'Content not found.' });
    const updated = await prisma.courseContent.update({
      where: { id: existing.id },
      data: {
        title: req.body.title != null ? String(req.body.title).trim() : undefined,
        body: req.body.body != null ? String(req.body.body).trim() : undefined,
        week: req.body.week != null ? Math.max(0, Number(req.body.week) || 0) : undefined,
      },
    });
    res.json(toContent(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update course content.', error: (err as Error).message });
  }
};

export const deleteContent = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const existing = await prisma.courseContent.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
    });
    if (!existing) return res.status(404).json({ message: 'Content not found.' });
    await prisma.courseContent.delete({ where: { id: existing.id } });
    res.json({ message: 'Content removed.', id: existing.id });
  } catch (err) {
    res.status(400).json({ message: 'Could not remove course content.', error: (err as Error).message });
  }
};

const loadRoster = (classId: string, sessionId: string, organizationId: string) =>
  buildSessionRoster(classId, sessionId, organizationId);

export { loadRoster, sessionPayload };

export const openSession = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    if (!hasModule(req.organization, 'student-attendance')) {
      return res.status(403).json({ message: 'Student attendance is not included in this organisation’s subscription.' });
    }
    const section = await ownedClass(ctx.organizationId, ctx.teacherId, req.params.id);
    if (!section) return res.status(404).json({ message: 'Class not found.' });

    const date = dayStamp(req.body.date);
    let slotId = String(req.body.slotId || '').trim() || null;
    if (slotId) {
      const slot = await prisma.timetableSlot.findFirst({
        where: { id: slotId, organizationId: ctx.organizationId, classId: section.id },
      });
      if (!slot) return res.status(400).json({ message: 'That timetable slot does not belong to this class.' });
      slotId = slot.id;
    }

    const existing = await prisma.attendanceSession.findFirst({
      where: {
        organizationId: ctx.organizationId,
        classId: section.id,
        teacherId: ctx.teacherId,
        date,
        status: 'open',
        ...(slotId ? { slotId } : {}),
      },
      include: { class: { select: { name: true, code: true, room: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const session = existing
      ? existing.qrExpiresAt.getTime() < Date.now()
        ? await prisma.attendanceSession.update({
            where: { id: existing.id },
            data: { qrToken: newQrToken(), qrExpiresAt: new Date(Date.now() + QR_TTL_MS) },
            include: { class: { select: { name: true, code: true, room: true } } },
          })
        : existing
      : await prisma.attendanceSession.create({
          data: {
            organizationId: ctx.organizationId,
            classId: section.id,
            slotId,
            teacherId: ctx.teacherId,
            date,
            qrToken: newQrToken(),
            qrExpiresAt: new Date(Date.now() + QR_TTL_MS),
            status: 'open',
          },
          include: { class: { select: { name: true, code: true, room: true } } },
        });

    res.status(existing ? 200 : 201).json(await sessionPayload(session, ctx.organizationId));
  } catch (err) {
    res.status(400).json({ message: 'Could not open an attendance session.', error: (err as Error).message });
  }
};

export const getSession = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const session = await prisma.attendanceSession.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
    res.json(await sessionPayload(session, ctx.organizationId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load attendance session', error: (err as Error).message });
  }
};

export const refreshQr = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const session = await prisma.attendanceSession.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
    if (session.status !== 'open') return res.status(400).json({ message: 'This session is closed.' });
    const updated = await prisma.attendanceSession.update({
      where: { id: session.id },
      data: { qrToken: newQrToken(), qrExpiresAt: new Date(Date.now() + QR_TTL_MS) },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    res.json(await sessionPayload(updated, ctx.organizationId));
  } catch (err) {
    res.status(400).json({ message: 'Could not refresh the QR code.', error: (err as Error).message });
  }
};

export const markSession = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const session = await prisma.attendanceSession.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
    if (session.status !== 'open') return res.status(400).json({ message: 'This session is closed.' });

    const personId = String(req.body.personId || '');
    const enrolled = await prisma.classEnrollment.findFirst({
      where: { classId: session.classId, personId },
    });
    if (!enrolled) return res.status(400).json({ message: 'That student is not in this class.' });

    const settings = await getSiteSettings(ctx.organizationId);
    const locationInput = parseScanLocation(req.body as Record<string, unknown>);
    let onCampus: boolean | null = null;
    let distanceMeters: number | null = null;
    const fence = settings ? parseFence(settings) : null;
    if (locationInput.latitude != null && locationInput.longitude != null && fence) {
      const verdict = evaluateFence(locationInput.latitude, locationInput.longitude, fence);
      onCampus = verdict.onCampus;
      distanceMeters = verdict.distanceMeters;
    }

    await prisma.sessionAttendance.upsert({
      where: { sessionId_personId: { sessionId: session.id, personId } },
      update: {
        status: parseStatus(req.body.status),
        latitude: locationInput.latitude,
        longitude: locationInput.longitude,
        accuracy: locationInput.accuracy,
        onCampus,
        distanceMeters,
      },
      create: {
        sessionId: session.id,
        personId,
        status: parseStatus(req.body.status),
        latitude: locationInput.latitude,
        longitude: locationInput.longitude,
        accuracy: locationInput.accuracy,
        onCampus,
        distanceMeters,
      },
    });
    res.json(await sessionPayload(session, ctx.organizationId));
  } catch (err) {
    res.status(400).json({ message: 'Could not save the mark.', error: (err as Error).message });
  }
};

export const closeSession = async (req: Request, res: Response) => {
  try {
    const ctx = requireOrg(req, res);
    if (!ctx) return;
    const session = await prisma.attendanceSession.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
    const updated = await prisma.attendanceSession.update({
      where: { id: session.id },
      data: { status: 'closed' },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    res.json(await sessionPayload(updated, ctx.organizationId));
  } catch (err) {
    res.status(400).json({ message: 'Could not close this session.', error: (err as Error).message });
  }
};
