import type { AttendanceKind, AttendancePerson, AttendanceStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { hasModule, orgId } from '../lib/tenant.js';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'leave'];

const moduleForKind = (kind: AttendanceKind) =>
  kind === 'staff' ? 'staff-attendance' : 'student-attendance';

const parseKind = (value: unknown): AttendanceKind | null => {
  const kind = String(value || '');
  if (kind === 'student' || kind === 'staff') return kind;
  return null;
};

const parseStatus = (value: unknown): AttendanceStatus => {
  const status = String(value || '') as AttendanceStatus;
  return STATUSES.includes(status) ? status : 'present';
};

const dayStart = (value: unknown) => {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const [year, month, day] = raw.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const toPerson = (doc: AttendancePerson & { records?: { status: AttendanceStatus; notes: string }[]; unit?: { id: string; name: string } | null }) => ({
  id: doc.id,
  kind: doc.kind,
  name: doc.name,
  title: doc.title,
  email: doc.email,
  active: doc.active,
  unitId: doc.unitId || null,
  unitName: doc.unit?.name || '',
  status: doc.records?.[0]?.status || null,
  notes: doc.records?.[0]?.notes || '',
});

const gate = (req: Request, res: Response, kind: AttendanceKind) => {
  if (!hasModule(req.organization, moduleForKind(kind))) {
    res.status(403).json({ message: 'This service is not included in your subscription.' });
    return false;
  }
  return true;
};

export const listAttendance = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const kind = parseKind(req.query.kind);
    if (!kind) return res.status(400).json({ message: 'Choose student or staff attendance.' });
    if (!gate(req, res, kind)) return;

    const date = dayStart(req.query.date);
    const people = await prisma.attendancePerson.findMany({
      where: { organizationId, kind },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { records: { where: { date }, take: 1 }, unit: { select: { id: true, name: true } } },
    });
    const present = people.filter((item) => item.records[0]?.status === 'present').length;
    const marked = people.filter((item) => item.records.length).length;
    res.json({
      kind,
      date: date.toISOString().slice(0, 10),
      present,
      marked,
      total: people.length,
      people: people.map(toPerson),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load attendance', error: (err as Error).message });
  }
};

export const createAttendancePerson = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const kind = parseKind(req.body.kind);
    if (!kind) return res.status(400).json({ message: 'Choose student or staff.' });
    if (!gate(req, res, kind)) return;
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Name is required.' });

    const unitId = String(req.body.unitId || '').trim() || null;
    if (unitId) {
      const unit = await prisma.orgUnit.findFirst({ where: { id: unitId, organizationId } });
      if (!unit) return res.status(400).json({ message: 'Choose a department that belongs to this organisation.' });
    }

    const person = await prisma.attendancePerson.create({
      data: {
        organizationId,
        kind,
        name,
        title: String(req.body.title || '').trim(),
        email: String(req.body.email || '').trim().toLowerCase(),
        active: req.body.active !== false,
        unitId,
      },
      include: { unit: { select: { id: true, name: true } } },
    });
    res.status(201).json(toPerson(person));
  } catch (err) {
    res.status(400).json({ message: 'Could not add this person.', error: (err as Error).message });
  }
};

export const updateAttendancePerson = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    const person = await prisma.attendancePerson.findFirst({
      where: { id: req.params.id, organizationId: organizationId || undefined },
    });
    if (!person) return res.status(404).json({ message: 'Person not found' });
    if (!gate(req, res, person.kind)) return;
    const updated = await prisma.attendancePerson.update({
      where: { id: person.id },
      data: {
        name: req.body.name != null ? String(req.body.name).trim() : undefined,
        title: req.body.title != null ? String(req.body.title).trim() : undefined,
        email: req.body.email != null ? String(req.body.email).trim().toLowerCase() : undefined,
        active: typeof req.body.active === 'boolean' ? req.body.active : undefined,
        unitId: req.body.unitId !== undefined ? String(req.body.unitId || '').trim() || null : undefined,
      },
      include: { unit: { select: { id: true, name: true } } },
    });
    res.json(toPerson(updated));
  } catch (err) {
    res.status(400).json({ message: 'Could not update this person.', error: (err as Error).message });
  }
};

export const deleteAttendancePerson = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    const person = await prisma.attendancePerson.findFirst({
      where: { id: req.params.id, organizationId: organizationId || undefined },
    });
    if (!person) return res.status(404).json({ message: 'Person not found' });
    if (!gate(req, res, person.kind)) return;
    await prisma.attendancePerson.delete({ where: { id: person.id } });
    res.json({ message: 'Removed', id: person.id });
  } catch (err) {
    res.status(400).json({ message: 'Could not remove this person.', error: (err as Error).message });
  }
};

export const saveAttendanceDay = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const kind = parseKind(req.body.kind);
    if (!kind) return res.status(400).json({ message: 'Choose student or staff attendance.' });
    if (!gate(req, res, kind)) return;
    const date = dayStart(req.body.date);
    const marks = Array.isArray(req.body.marks) ? req.body.marks : [];
    const people = await prisma.attendancePerson.findMany({
      where: { organizationId, kind, active: true },
      select: { id: true },
    });
    const allowed = new Set(people.map((item) => item.id));
    await Promise.all(
      marks
        .map((mark: { personId?: string; status?: string; notes?: string }) => ({
          personId: String(mark.personId || ''),
          status: parseStatus(mark.status),
          notes: String(mark.notes || '').trim(),
        }))
        .filter((mark) => allowed.has(mark.personId))
        .map((mark) =>
          prisma.attendanceRecord.upsert({
            where: { personId_date: { personId: mark.personId, date } },
            update: { status: mark.status, notes: mark.notes },
            create: {
              organizationId,
              personId: mark.personId,
              date,
              status: mark.status,
              notes: mark.notes,
            },
          })
        )
    );
    req.query.kind = kind;
    req.query.date = date.toISOString().slice(0, 10);
    return listAttendance(req, res);
  } catch (err) {
    res.status(400).json({ message: 'Could not save attendance.', error: (err as Error).message });
  }
};
