import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { evaluateFence, parseFence, parseQrToken, parseScanLocation } from '../lib/geofence.js';
import { hasModule, orgId } from '../lib/tenant.js';
import { getSiteSettings } from './settingsController.js';
import { loadRoster, sessionPayload } from './teachingController.js';

const findStudentPerson = async (organizationId: string, email: string) =>
  prisma.attendancePerson.findFirst({
    where: { organizationId, kind: 'student', email, active: true },
  });

export const scanStudentAttendance = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.user) {
      return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    }
    if (!hasModule(req.organization, 'student-attendance')) {
      return res.status(403).json({ message: 'Student attendance is not enabled for this organisation.' });
    }

    const qrToken = parseQrToken(req.body.qrToken ?? req.body.qrPayload ?? req.body.token ?? req.body.code);
    if (!qrToken) return res.status(400).json({ message: 'A valid attendance QR code is required.' });

    const session = await prisma.attendanceSession.findFirst({
      where: { organizationId, qrToken, status: 'open' },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    if (!session) return res.status(404).json({ message: 'This attendance session is not open or the QR code expired.' });
    if (session.qrExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'This QR code has expired. Ask your teacher to refresh it.' });
    }

    const person = await findStudentPerson(organizationId, req.user.email);
    if (!person) {
      return res.status(403).json({ message: 'Your account is not on the student attendance roster.' });
    }

    const enrolled = await prisma.classEnrollment.findFirst({
      where: { classId: session.classId, personId: person.id },
    });
    if (!enrolled) {
      return res.status(403).json({ message: 'You are not enrolled in this class.' });
    }

    const settings = await getSiteSettings(organizationId);
    if (!settings) {
      return res.status(503).json({ message: 'Campus settings are not available.' });
    }
    const locationInput = parseScanLocation(req.body as Record<string, unknown>);
    const fence = parseFence(settings);
    let onCampus: boolean | null = null;
    let distanceMeters: number | null = null;

    if (settings.attendanceLocationEnabled) {
      if (locationInput.latitude == null || locationInput.longitude == null) {
        return res.status(400).json({ message: 'Location is required to mark attendance on campus.' });
      }
      if (!fence) {
        return res.status(503).json({ message: 'Campus location is not configured yet. Ask your admin to set it.' });
      }
      const verdict = evaluateFence(locationInput.latitude, locationInput.longitude, fence);
      onCampus = verdict.onCampus;
      distanceMeters = verdict.distanceMeters;
      if (!verdict.onCampus) {
        return res.status(403).json({
          message: `You appear to be ${Math.round(verdict.distanceMeters)} m from campus. Move inside the allowed area and scan again.`,
          onCampus: false,
          distanceMeters: verdict.distanceMeters,
        });
      }
    } else if (locationInput.latitude != null && locationInput.longitude != null && fence) {
      const verdict = evaluateFence(locationInput.latitude, locationInput.longitude, fence);
      onCampus = verdict.onCampus;
      distanceMeters = verdict.distanceMeters;
    }

    await prisma.sessionAttendance.upsert({
      where: { sessionId_personId: { sessionId: session.id, personId: person.id } },
      update: {
        status: 'present',
        latitude: locationInput.latitude,
        longitude: locationInput.longitude,
        accuracy: locationInput.accuracy,
        onCampus,
        distanceMeters,
      },
      create: {
        sessionId: session.id,
        personId: person.id,
        status: 'present',
        latitude: locationInput.latitude,
        longitude: locationInput.longitude,
        accuracy: locationInput.accuracy,
        onCampus,
        distanceMeters,
      },
    });

    res.json({
      message: 'You are marked present.',
      status: 'present',
      onCampus,
      distanceMeters,
      session: await sessionPayload(session, await loadRoster(session.classId, session.id)),
    });
  } catch (err) {
    res.status(400).json({ message: 'Could not mark attendance.', error: (err as Error).message });
  }
};

export const listAdminSessions = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    const dateRaw = String(req.query.date || '').slice(0, 10);
    const where: { organizationId: string; date?: Date } = { organizationId };
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      const [year, month, day] = dateRaw.split('-').map(Number);
      where.date = new Date(Date.UTC(year, month - 1, day));
    }
    const sessions = await prisma.attendanceSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { name: true, code: true, room: true } },
        teacher: { select: { name: true, email: true } },
        _count: { select: { marks: true } },
      },
      take: 30,
    });
    res.json({
      sessions: sessions.map((row) => ({
        id: row.id,
        className: row.class.name,
        classCode: row.class.code,
        room: row.class.room,
        date: row.date.toISOString().slice(0, 10),
        status: row.status,
        teacherName: row.teacher.name || row.teacher.email,
        markCount: row._count.marks,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load sessions.', error: (err as Error).message });
  }
};

export const getAdminSession = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Organisation required.' });
    const session = await prisma.attendanceSession.findFirst({
      where: { id: req.params.id, organizationId },
      include: { class: { select: { name: true, code: true, room: true } } },
    });
    if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
    res.json(await sessionPayload(session, await loadRoster(session.classId, session.id)));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load session.', error: (err as Error).message });
  }
};
