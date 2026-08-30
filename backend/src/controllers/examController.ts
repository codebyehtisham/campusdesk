import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { orgId } from '../lib/tenant.js';

const gradeFor = (marks: number | null, max: number) => {
  if (marks == null || max <= 0) return '';
  const pct = (marks / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
};

export const listExams = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const exams = await prisma.exam.findMany({
      where: { organizationId },
      include: {
        class: { select: { id: true, name: true, code: true } },
        _count: { select: { marks: true } },
      },
      orderBy: [{ examDate: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load exams', error: (err as Error).message });
  }
};

export const createExam = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Exam title is required.' });

    const classId = req.body.classId ? String(req.body.classId).trim() : null;
    if (classId) {
      const cls = await prisma.classSection.findFirst({ where: { id: classId, organizationId } });
      if (!cls) return res.status(404).json({ message: 'Class not found' });
    }

    const exam = await prisma.exam.create({
      data: {
        organizationId,
        title,
        classId,
        maxMarks: Math.max(1, Math.round(Number(req.body.maxMarks) || 100)),
        examDate: req.body.examDate ? new Date(req.body.examDate) : null,
      },
      include: { class: { select: { id: true, name: true, code: true } } },
    });
    res.status(201).json(exam);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create exam', error: (err as Error).message });
  }
};

export const updateExam = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const exam = await prisma.exam.findFirst({ where: { id: req.params.id, organizationId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const updated = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        title: req.body.title != null ? String(req.body.title).trim() : undefined,
        maxMarks: req.body.maxMarks != null ? Math.max(1, Math.round(Number(req.body.maxMarks))) : undefined,
        examDate: req.body.examDate != null ? (req.body.examDate ? new Date(req.body.examDate) : null) : undefined,
        active: req.body.active != null ? Boolean(req.body.active) : undefined,
      },
      include: { class: { select: { id: true, name: true, code: true } } },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update exam', error: (err as Error).message });
  }
};

export const getExamMarks = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const exam = await prisma.exam.findFirst({
      where: { id: req.params.id, organizationId },
      include: { class: { select: { id: true, name: true } } },
    });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    let students: { id: string; name: string; title: string }[] = [];
    if (exam.classId) {
      const enrollments = await prisma.classEnrollment.findMany({
        where: { classId: exam.classId },
        include: { person: { select: { id: true, name: true, title: true, active: true } } },
      });
      students = enrollments
        .map((item) => item.person)
        .filter((person) => person.active)
        .map((person) => ({ id: person.id, name: person.name, title: person.title }));
    } else {
      const roster = await prisma.attendancePerson.findMany({
        where: { organizationId, kind: 'student', active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, title: true },
      });
      students = roster;
    }

    const marks = await prisma.examMark.findMany({ where: { examId: exam.id } });
    const markMap = new Map(marks.map((item) => [item.personId, item]));

    res.json({
      exam,
      rows: students.map((student) => {
        const mark = markMap.get(student.id);
        return {
          personId: student.id,
          name: student.name,
          title: student.title,
          marksObtained: mark?.marksObtained ?? null,
          grade: mark?.grade || '',
          notes: mark?.notes || '',
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load marks', error: (err as Error).message });
  }
};

export const saveExamMarks = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const exam = await prisma.exam.findFirst({ where: { id: req.params.id, organizationId } });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const rows = Array.isArray(req.body.marks) ? req.body.marks : [];
    const validRows = rows.filter((row: { personId?: string }) => String(row.personId || '').trim());
    await prisma.$transaction(
      validRows.map((row: { personId?: string; marksObtained?: number | null; notes?: string }) => {
        const personId = String(row.personId || '').trim();
        const raw = row.marksObtained;
        const marksObtained =
          raw === null || raw === undefined || (typeof raw === 'string' && raw === '') ? null : Math.round(Number(raw));
        const grade = marksObtained == null ? '' : gradeFor(marksObtained, exam.maxMarks);
        return prisma.examMark.upsert({
          where: { examId_personId: { examId: exam.id, personId } },
          create: {
            organizationId,
            examId: exam.id,
            personId,
            marksObtained,
            grade,
            notes: String(row.notes || '').trim(),
          },
          update: {
            marksObtained,
            grade,
            notes: String(row.notes || '').trim(),
          },
        });
      })
    );

    res.json({ message: 'Marks saved.' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to save marks', error: (err as Error).message });
  }
};

export const listExamClasses = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const classes = await prisma.classSection.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load classes', error: (err as Error).message });
  }
};
