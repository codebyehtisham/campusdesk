import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { createNotification } from '../lib/notifications.js';
import { gradeFor, parseDay, toStudentLeave } from '../lib/lmsShared.js';
import { orgId } from '../lib/tenant.js';
import { toSubmissionFile } from '../lib/assignmentFiles.js';

const requireTeacher = (req: Request, res: Response) => {
  const organizationId = orgId(req);
  if (!organizationId || !req.user) {
    res.status(403).json({ message: 'Account is not linked to an organisation.' });
    return null;
  }
  return { organizationId, teacherId: req.user.id };
};

const ownedClass = (organizationId: string, teacherId: string, classId: string) =>
  prisma.classSection.findFirst({
    where: { id: classId, organizationId, teacherId, active: true },
  });

const toAssignmentRow = (row: {
  id: string;
  classId: string;
  title: string;
  description: string;
  dueAt: Date | null;
  maxMarks: number;
  published: boolean;
  createdAt: Date;
  _count?: { submissions: number };
}) => ({
  id: row.id,
  classId: row.classId,
  title: row.title,
  description: row.description,
  dueAt: row.dueAt?.toISOString() || null,
  maxMarks: row.maxMarks,
  published: row.published,
  createdAt: row.createdAt,
  submissionCount: row._count?.submissions ?? 0,
});

export const listClassAssignments = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const cls = await ownedClass(ctx.organizationId, ctx.teacherId, req.params.classId);
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const items = await prisma.assignment.findMany({
      where: { organizationId: ctx.organizationId, classId: cls.id },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { submissions: true } } },
    });
    res.json(items.map(toAssignmentRow));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load assignments', error: (err as Error).message });
  }
};

export const createClassAssignment = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const cls = await ownedClass(ctx.organizationId, ctx.teacherId, req.params.classId);
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Assignment title is required.' });

    const item = await prisma.assignment.create({
      data: {
        organizationId: ctx.organizationId,
        classId: cls.id,
        teacherId: ctx.teacherId,
        title,
        description: String(req.body.description || '').trim(),
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
        maxMarks: Math.max(1, Math.round(Number(req.body.maxMarks) || 100)),
        published: req.body.published !== false,
      },
    });
    res.status(201).json(toAssignmentRow(item));
  } catch (err) {
    res.status(400).json({ message: 'Failed to create assignment', error: (err as Error).message });
  }
};

export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const item = await prisma.assignment.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
    });
    if (!item) return res.status(404).json({ message: 'Assignment not found' });

    const updated = await prisma.assignment.update({
      where: { id: item.id },
      data: {
        title: req.body.title != null ? String(req.body.title).trim() : undefined,
        description: req.body.description != null ? String(req.body.description).trim() : undefined,
        dueAt: req.body.dueAt !== undefined ? (req.body.dueAt ? new Date(req.body.dueAt) : null) : undefined,
        maxMarks: req.body.maxMarks != null ? Math.max(1, Math.round(Number(req.body.maxMarks))) : undefined,
        published: req.body.published != null ? Boolean(req.body.published) : undefined,
      },
    });
    res.json(toAssignmentRow(updated));
  } catch (err) {
    res.status(400).json({ message: 'Failed to update assignment', error: (err as Error).message });
  }
};

export const getAssignmentSubmissions = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const assignment = await prisma.assignment.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: { class: { select: { name: true, code: true } } },
    });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId: assignment.classId },
      include: { person: { select: { id: true, name: true, title: true, email: true, active: true } } },
    });
    const submissions = await prisma.assignmentSubmission.findMany({ where: { assignmentId: assignment.id } });
    const submissionMap = new Map(submissions.map((row) => [row.personId, row]));

    res.json({
      assignment: toAssignmentRow(assignment),
      className: assignment.class.name,
      rows: enrollments
        .filter((row) => row.person.active)
        .map((row) => {
          const submission = submissionMap.get(row.person.id);
          return {
            personId: row.person.id,
            name: row.person.name,
            title: row.person.title,
            email: row.person.email,
            submittedAt: submission?.submittedAt || null,
            body: submission?.body || '',
            file: submission ? toSubmissionFile(submission) : null,
            marksObtained: submission?.marksObtained ?? null,
            feedback: submission?.feedback || '',
            gradedAt: submission?.gradedAt || null,
          };
        }),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load submissions', error: (err as Error).message });
  }
};

export const gradeAssignmentSubmission = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const assignment = await prisma.assignment.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
    });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const personId = String(req.params.personId || '').trim();
    const submission = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId: assignment.id, personId },
    });
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    const raw = req.body.marksObtained;
    const marksObtained =
      raw === null || raw === undefined || (typeof raw === 'string' && raw === '')
        ? null
        : Math.max(0, Math.round(Number(raw)));

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        marksObtained,
        feedback: String(req.body.feedback || '').trim(),
        gradedAt: new Date(),
      },
    });

    const person = await prisma.attendancePerson.findUnique({
      where: { id: personId },
      select: { email: true, name: true },
    });
    if (person?.email) {
      const studentUser = await prisma.user.findFirst({
        where: { email: person.email, organizationId: ctx.organizationId, role: 'applicant' },
        select: { id: true },
      });
      if (studentUser) {
        await createNotification({
          userId: studentUser.id,
          organizationId: ctx.organizationId,
          type: 'assignment_graded',
          title: 'Assignment graded',
          body: `Your submission for "${assignment.title}" was graded${marksObtained != null ? `: ${marksObtained}/${assignment.maxMarks}` : '.'}`,
          data: { assignmentId: assignment.id },
        });
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to grade submission', error: (err as Error).message });
  }
};

export const listClassQuizzes = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const cls = await ownedClass(ctx.organizationId, ctx.teacherId, req.params.classId);
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const items = await prisma.classQuiz.findMany({
      where: { organizationId: ctx.organizationId, classId: cls.id },
      orderBy: [{ quizDate: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { marks: true } } },
    });
    res.json(
      items.map((item) => ({
        id: item.id,
        classId: item.classId,
        title: item.title,
        quizDate: item.quizDate?.toISOString().slice(0, 10) || null,
        maxMarks: item.maxMarks,
        notes: item.notes,
        markCount: item._count.marks,
        createdAt: item.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load quizzes', error: (err as Error).message });
  }
};

export const createClassQuiz = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const cls = await ownedClass(ctx.organizationId, ctx.teacherId, req.params.classId);
    if (!cls) return res.status(404).json({ message: 'Class not found' });

    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Quiz title is required.' });

    const item = await prisma.classQuiz.create({
      data: {
        organizationId: ctx.organizationId,
        classId: cls.id,
        teacherId: ctx.teacherId,
        title,
        quizDate: req.body.quizDate ? parseDay(req.body.quizDate) : null,
        maxMarks: Math.max(1, Math.round(Number(req.body.maxMarks) || 10)),
        notes: String(req.body.notes || '').trim(),
      },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create quiz', error: (err as Error).message });
  }
};

export const getQuizMarks = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const quiz = await prisma.classQuiz.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: { class: { select: { name: true, code: true } } },
    });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId: quiz.classId },
      include: { person: { select: { id: true, name: true, title: true, active: true } } },
    });
    const marks = await prisma.classQuizMark.findMany({ where: { quizId: quiz.id } });
    const markMap = new Map(marks.map((row) => [row.personId, row]));

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        className: quiz.class.name,
        quizDate: quiz.quizDate?.toISOString().slice(0, 10) || null,
        maxMarks: quiz.maxMarks,
        notes: quiz.notes,
      },
      rows: enrollments
        .filter((row) => row.person.active)
        .map((row) => {
          const mark = markMap.get(row.person.id);
          return {
            personId: row.person.id,
            name: row.person.name,
            title: row.person.title,
            marksObtained: mark?.marksObtained ?? null,
            notes: mark?.notes || '',
            grade: gradeFor(mark?.marksObtained ?? null, quiz.maxMarks),
          };
        }),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load quiz marks', error: (err as Error).message });
  }
};

export const saveQuizMarks = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const quiz = await prisma.classQuiz.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
    });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const rows = Array.isArray(req.body.marks) ? req.body.marks : [];
    await prisma.$transaction(
      rows
        .filter((row: { personId?: string }) => String(row.personId || '').trim())
        .map((row: { personId?: string; marksObtained?: number | null; notes?: string }) => {
          const personId = String(row.personId || '').trim();
          const raw = row.marksObtained;
          const marksObtained =
            raw === null || raw === undefined || (typeof raw === 'string' && raw === '')
              ? null
              : Math.max(0, Math.round(Number(raw)));
          return prisma.classQuizMark.upsert({
            where: { quizId_personId: { quizId: quiz.id, personId } },
            create: {
              organizationId: ctx.organizationId,
              quizId: quiz.id,
              personId,
              marksObtained,
              notes: String(row.notes || '').trim(),
            },
            update: {
              marksObtained,
              notes: String(row.notes || '').trim(),
            },
          });
        })
    );

    res.json({ message: 'Quiz marks saved.' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to save quiz marks', error: (err as Error).message });
  }
};

export const listFacultyStudentLeaves = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const status = String(req.query.status || '').trim();
    const classId = String(req.query.classId || '').trim();
    const items = await prisma.studentLeaveRequest.findMany({
      where: {
        organizationId: ctx.organizationId,
        teacherId: ctx.teacherId,
        ...(status && ['pending', 'approved', 'rejected'].includes(status)
          ? { status: status as 'pending' | 'approved' | 'rejected' }
          : {}),
        ...(classId ? { classId } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        person: { select: { id: true, name: true, email: true, title: true } },
        class: { select: { id: true, name: true, code: true } },
      },
    });
    res.json(items.map((row) => toStudentLeave({ ...row, teacher: { id: ctx.teacherId, name: req.user!.name } })));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load student leave requests', error: (err as Error).message });
  }
};

export const getFacultyStudentLeave = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const leave = await prisma.studentLeaveRequest.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: {
        person: { select: { id: true, name: true, email: true, title: true } },
        class: { select: { id: true, name: true, code: true } },
      },
    });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    const history = await prisma.studentLeaveRequest.findMany({
      where: { organizationId: ctx.organizationId, personId: leave.personId, classId: leave.classId },
      orderBy: { createdAt: 'desc' },
      include: { class: { select: { id: true, name: true, code: true } } },
    });

    res.json({
      leave: toStudentLeave({ ...leave, teacher: { id: ctx.teacherId, name: req.user!.name } }),
      student: leave.person,
      history: history.map((row) => toStudentLeave({ ...row, teacher: { id: ctx.teacherId, name: req.user!.name } })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load leave request', error: (err as Error).message });
  }
};

export const decideFacultyStudentLeave = async (req: Request, res: Response) => {
  try {
    const ctx = requireTeacher(req, res);
    if (!ctx) return;
    const decision = String(req.body.decision || '').trim();
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ message: 'Decision must be approved or rejected.' });
    }

    const leave = await prisma.studentLeaveRequest.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, teacherId: ctx.teacherId },
      include: { class: { select: { name: true } }, person: { select: { email: true, name: true } } },
    });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ message: 'This leave request was already reviewed.' });

    const updated = await prisma.studentLeaveRequest.update({
      where: { id: leave.id },
      data: {
        status: decision,
        reviewNotes: String(req.body.reviewNotes || '').trim(),
        reviewedAt: new Date(),
      },
      include: { class: { select: { id: true, name: true, code: true } } },
    });

    if (leave.person.email) {
      const studentUser = await prisma.user.findFirst({
        where: { email: leave.person.email, organizationId: ctx.organizationId, role: 'applicant' },
        select: { id: true },
      });
      if (studentUser) {
        await createNotification({
          userId: studentUser.id,
          organizationId: ctx.organizationId,
          type: decision === 'approved' ? 'student_leave_approved' : 'student_leave_rejected',
          title: decision === 'approved' ? 'Leave approved' : 'Leave rejected',
          body: `Your ${leave.type} leave for ${leave.class.name} was ${decision}.`,
          data: { leaveId: leave.id, classId: leave.classId },
        });
      }
    }

    res.json(toStudentLeave({ ...updated, teacher: { id: ctx.teacherId, name: req.user!.name } }));
  } catch (err) {
    res.status(400).json({ message: 'Failed to update leave request', error: (err as Error).message });
  }
};
