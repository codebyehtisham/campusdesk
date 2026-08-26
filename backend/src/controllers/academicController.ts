import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId } from '../lib/tenant.js';
import { minutes, parseDay, parseTime } from '../lib/teaching.js';

const teacherSelect = { id: true, name: true, email: true };
const personSelect = { id: true, name: true, title: true, email: true, active: true };
const courseSelect = { id: true, title: true, level: true };

const toClass = (row: {
  id: string;
  name: string;
  code: string;
  room: string;
  active: boolean;
  courseId: string | null;
  teacherId: string | null;
  course: { id: string; title: string; level: string } | null;
  teacher: { id: string; name: string; email: string } | null;
  enrollments: { personId: string; person: { id: string; name: string; title: string; email: string; active: boolean } }[];
  _count?: { slots: number; enrollments: number };
}) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  room: row.room,
  active: row.active,
  courseId: row.courseId,
  teacherId: row.teacherId,
  course: row.course,
  teacher: row.teacher,
  studentIds: row.enrollments.map((item) => item.personId),
  students: row.enrollments.map((item) => item.person),
  slotCount: row._count?.slots ?? 0,
  studentCount: row._count?.enrollments ?? row.enrollments.length,
});

const toSlot = (row: {
  id: string;
  classId: string;
  teacherId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  class: { id: string; name: string; code: string };
  teacher: { id: string; name: string; email: string } | null;
}) => ({
  id: row.id,
  classId: row.classId,
  teacherId: row.teacherId,
  dayOfWeek: row.dayOfWeek,
  startTime: row.startTime,
  endTime: row.endTime,
  room: row.room,
  className: row.class.name,
  classCode: row.class.code,
  teacher: row.teacher,
});

const classInclude = {
  course: { select: courseSelect },
  teacher: { select: teacherSelect },
  enrollments: { include: { person: { select: personSelect } }, orderBy: { person: { name: 'asc' as const } } },
  _count: { select: { slots: true, enrollments: true } },
};

const slotInclude = {
  class: { select: { id: true, name: true, code: true } },
  teacher: { select: teacherSelect },
};

const requireOrg = (req: Request, res: Response) => {
  const organizationId = orgId(req);
  if (!organizationId) {
    res.status(403).json({ message: 'Account is not linked to an organisation.' });
    return null;
  }
  return organizationId;
};

const findTeacher = (organizationId: string, teacherId: string | null | undefined) => {
  if (!teacherId) return Promise.resolve(null);
  return prisma.user.findFirst({
    where: { id: teacherId, organizationId, role: 'teacher', blocked: false },
    select: teacherSelect,
  });
};

export const getTeachingAdmin = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;

    const [classes, slots, teachers, programmes, students] = await Promise.all([
      prisma.classSection.findMany({
        where: { organizationId },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        include: classInclude,
      }),
      prisma.timetableSlot.findMany({
        where: { organizationId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: slotInclude,
      }),
      prisma.user.findMany({
        where: { organizationId, role: 'teacher' },
        orderBy: { name: 'asc' },
        select: { ...teacherSelect, blocked: true },
      }),
      prisma.course.findMany({
        where: { organizationId },
        orderBy: { order: 'asc' },
        select: courseSelect,
      }),
      prisma.attendancePerson.findMany({
        where: { organizationId, kind: 'student', active: true },
        orderBy: { name: 'asc' },
        select: personSelect,
      }),
    ]);

    res.json({
      classes: classes.map(toClass),
      slots: slots.map(toSlot),
      teachers,
      programmes,
      students,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load courses and timetable', error: (err as Error).message });
  }
};

export const createClass = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Class name is required.' });

    const teacher = await findTeacher(organizationId, req.body.teacherId || null);
    const courseId = String(req.body.courseId || '').trim() || null;
    if (courseId) {
      const course = await prisma.course.findFirst({ where: { id: courseId, organizationId } });
      if (!course) return res.status(400).json({ message: 'Choose a programme that belongs to this organisation.' });
    }

    const created = await prisma.classSection.create({
      data: {
        organizationId,
        name,
        code: String(req.body.code || '').trim(),
        room: String(req.body.room || '').trim(),
        courseId,
        teacherId: teacher?.id || null,
        active: req.body.active !== false,
      },
      include: classInclude,
    });
    res.status(201).json(toClass(created));
  } catch (err) {
    res.status(400).json({ message: 'Could not create this class.', error: (err as Error).message });
  }
};

export const updateClass = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const existing = await prisma.classSection.findFirst({ where: { id: req.params.id, organizationId } });
    if (!existing) return res.status(404).json({ message: 'Class not found.' });

    let teacherId = existing.teacherId;
    if (req.body.teacherId !== undefined) {
      const teacher = await findTeacher(organizationId, req.body.teacherId || null);
      teacherId = teacher?.id || null;
    }

    let courseId = existing.courseId;
    if (req.body.courseId !== undefined) {
      const next = String(req.body.courseId || '').trim() || null;
      if (next) {
        const course = await prisma.course.findFirst({ where: { id: next, organizationId } });
        if (!course) return res.status(400).json({ message: 'Choose a programme that belongs to this organisation.' });
      }
      courseId = next;
    }

    const updated = await prisma.classSection.update({
      where: { id: existing.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        code: req.body.code != null ? String(req.body.code).trim() : undefined,
        room: req.body.room != null ? String(req.body.room).trim() : undefined,
        active: req.body.active != null ? req.body.active !== false : undefined,
        teacherId,
        courseId,
      },
      include: classInclude,
    });

    if (teacherId !== existing.teacherId) {
      await prisma.timetableSlot.updateMany({
        where: { classId: existing.id, organizationId },
        data: { teacherId },
      });
    }

    res.json(toClass(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update this class.', error: (err as Error).message });
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const existing = await prisma.classSection.findFirst({ where: { id: req.params.id, organizationId } });
    if (!existing) return res.status(404).json({ message: 'Class not found.' });
    await prisma.classSection.delete({ where: { id: existing.id } });
    res.json({ message: 'Class removed.', id: existing.id });
  } catch (err) {
    res.status(400).json({ message: 'Could not remove this class.', error: (err as Error).message });
  }
};

export const setEnrollments = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const existing = await prisma.classSection.findFirst({ where: { id: req.params.id, organizationId } });
    if (!existing) return res.status(404).json({ message: 'Class not found.' });

    const ids: string[] = Array.isArray(req.body.personIds) ? req.body.personIds.map((id: unknown) => String(id)) : [];
    const students = await prisma.attendancePerson.findMany({
      where: { organizationId, kind: 'student', id: { in: ids } },
      select: { id: true },
    });
    const allowed = new Set(students.map((item) => item.id));
    const personIds = ids.filter((id) => allowed.has(id));

    await prisma.$transaction([
      prisma.classEnrollment.deleteMany({ where: { classId: existing.id } }),
      ...(personIds.length
        ? [
            prisma.classEnrollment.createMany({
              data: personIds.map((personId) => ({ classId: existing.id, personId })),
            }),
          ]
        : []),
    ]);

    const updated = await prisma.classSection.findUnique({ where: { id: existing.id }, include: classInclude });
    res.json(toClass(updated!));
  } catch (err) {
    res.status(400).json({ message: 'Could not update the class list.', error: (err as Error).message });
  }
};

const parseSlotBody = (body: Record<string, unknown>) => {
  const dayOfWeek = parseDay(body.dayOfWeek);
  const startTime = parseTime(body.startTime);
  const endTime = parseTime(body.endTime);
  if (!dayOfWeek) return { error: 'Choose a weekday.' };
  if (!startTime || !endTime) return { error: 'Start and end times must be HH:MM.' };
  if (minutes(endTime) <= minutes(startTime)) return { error: 'End time must be after start time.' };
  return { dayOfWeek, startTime, endTime, room: String(body.room || '').trim() };
};

export const createSlot = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const parsed = parseSlotBody(req.body);
    if ('error' in parsed) return res.status(400).json({ message: parsed.error });

    const section = await prisma.classSection.findFirst({ where: { id: String(req.body.classId || ''), organizationId } });
    if (!section) return res.status(400).json({ message: 'Choose a class for this slot.' });
    const teacher = (await findTeacher(organizationId, req.body.teacherId || section.teacherId)) || null;

    const created = await prisma.timetableSlot.create({
      data: {
        organizationId,
        classId: section.id,
        teacherId: teacher?.id || section.teacherId,
        dayOfWeek: parsed.dayOfWeek,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        room: parsed.room || section.room,
      },
      include: slotInclude,
    });
    res.status(201).json(toSlot(created));
  } catch (err) {
    res.status(400).json({ message: 'Could not add this timetable slot.', error: (err as Error).message });
  }
};

export const updateSlot = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const existing = await prisma.timetableSlot.findFirst({ where: { id: req.params.id, organizationId } });
    if (!existing) return res.status(404).json({ message: 'Timetable slot not found.' });

    const parsed = parseSlotBody({
      dayOfWeek: req.body.dayOfWeek ?? existing.dayOfWeek,
      startTime: req.body.startTime ?? existing.startTime,
      endTime: req.body.endTime ?? existing.endTime,
      room: req.body.room ?? existing.room,
    });
    if ('error' in parsed) return res.status(400).json({ message: parsed.error });

    let classId = existing.classId;
    if (req.body.classId) {
      const section = await prisma.classSection.findFirst({ where: { id: String(req.body.classId), organizationId } });
      if (!section) return res.status(400).json({ message: 'Choose a class for this slot.' });
      classId = section.id;
    }
    const section = await prisma.classSection.findFirst({ where: { id: classId, organizationId } });
    const teacher = await findTeacher(organizationId, req.body.teacherId || section?.teacherId);

    const updated = await prisma.timetableSlot.update({
      where: { id: existing.id },
      data: {
        classId,
        teacherId: teacher?.id || section?.teacherId || null,
        dayOfWeek: parsed.dayOfWeek,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        room: parsed.room,
      },
      include: slotInclude,
    });
    res.json(toSlot(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update this timetable slot.', error: (err as Error).message });
  }
};

export const deleteSlot = async (req: Request, res: Response) => {
  try {
    const organizationId = requireOrg(req, res);
    if (!organizationId) return;
    const existing = await prisma.timetableSlot.findFirst({ where: { id: req.params.id, organizationId } });
    if (!existing) return res.status(404).json({ message: 'Timetable slot not found.' });
    await prisma.timetableSlot.delete({ where: { id: existing.id } });
    res.json({ message: 'Slot removed.', id: existing.id });
  } catch (err) {
    res.status(400).json({ message: 'Could not remove this slot.', error: (err as Error).message });
  }
};
