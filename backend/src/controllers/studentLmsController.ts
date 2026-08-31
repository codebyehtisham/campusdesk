import type { Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { gradeFor, leaveDayCount, parseDay, parseLeaveType, toStudentLeave } from '../lib/lmsShared.js';
import {
  findStudentPersonWithClasses,
  requireStudentPerson,
  studentEnrolledInClass,
  toClassCard,
} from '../lib/studentContext.js';
import { createNotification } from '../lib/notifications.js';
import { orgId } from '../lib/tenant.js';
import { parseAssignmentFileUpload, storeAssignmentSubmissionFile, toSubmissionFile } from '../lib/assignmentFiles.js';

const toAssignment = (row: {
  id: string;
  classId: string;
  title: string;
  description: string;
  dueAt: Date | null;
  maxMarks: number;
  createdAt: Date;
  class?: { name: string; code: string };
  submissions?: {
    body: string;
    fileUrl: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    marksObtained: number | null;
    feedback: string;
    submittedAt: Date;
    gradedAt: Date | null;
  }[];
}) => {
  const submission = row.submissions?.[0];
  return {
    id: row.id,
    classId: row.classId,
    className: row.class?.name,
    classCode: row.class?.code,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt?.toISOString() || null,
    maxMarks: row.maxMarks,
    createdAt: row.createdAt,
    submission: submission
      ? {
          submittedAt: submission.submittedAt,
          body: submission.body,
          file: toSubmissionFile(submission),
          marksObtained: submission.marksObtained,
          feedback: submission.feedback,
          gradedAt: submission.gradedAt,
          status: submission.gradedAt ? 'graded' : 'submitted',
        }
      : null,
  };
};

export const studentDashboard = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const { organizationId, person } = ctx;

    const enrollments = await prisma.classEnrollment.findMany({
      where: { personId: person.id, class: { organizationId, active: true } },
      include: { class: { select: { id: true, name: true, code: true } } },
    });
    const classIds = enrollments.map((item) => item.classId);

    const [pendingAssignments, pendingLeaves, recentQuizMarks, upcomingSessions] = await Promise.all([
      prisma.assignment.count({
        where: {
          organizationId,
          classId: { in: classIds },
          published: true,
          submissions: { none: { personId: person.id } },
        },
      }),
      prisma.studentLeaveRequest.count({
        where: { organizationId, personId: person.id, status: 'pending' },
      }),
      prisma.classQuizMark.findMany({
        where: { organizationId, personId: person.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { quiz: { select: { title: true, maxMarks: true, quizDate: true, class: { select: { name: true } } } } },
      }),
      prisma.attendanceSession.findMany({
        where: { organizationId, classId: { in: classIds }, status: 'open' },
        orderBy: { date: 'desc' },
        take: 5,
        include: { class: { select: { name: true, code: true } } },
      }),
    ]);

    res.json({
      classes: enrollments.length,
      pendingAssignments,
      pendingLeaves,
      recentQuizMarks: recentQuizMarks.map((row) => ({
        quizTitle: row.quiz.title,
        className: row.quiz.class.name,
        marksObtained: row.marksObtained,
        maxMarks: row.quiz.maxMarks,
        quizDate: row.quiz.quizDate?.toISOString().slice(0, 10) || null,
        grade: gradeFor(row.marksObtained, row.quiz.maxMarks),
      })),
      openSessions: upcomingSessions.map((session) => ({
        id: session.id,
        className: session.class.name,
        classCode: session.class.code,
        date: session.date.toISOString().slice(0, 10),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load dashboard', error: (err as Error).message });
  }
};

export const studentProfile = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const person = await findStudentPersonWithClasses(ctx.user);
    if (!person) return res.status(403).json({ message: 'Student profile not found.' });

    res.json({
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
      person: { id: person.id, name: person.name, title: person.title, email: person.email },
      classes: person.enrollments.map((item) => toClassCard(item.class)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load profile', error: (err as Error).message });
  }
};

export const listStudentClasses = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const person = await findStudentPersonWithClasses(ctx.user);
    if (!person) return res.status(403).json({ message: 'Student profile not found.' });
    res.json(person.enrollments.map((item) => toClassCard(item.class)));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load classes', error: (err as Error).message });
  }
};

export const getStudentClass = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const enrollment = await studentEnrolledInClass(ctx.person.id, req.params.classId, ctx.organizationId);
    if (!enrollment) return res.status(404).json({ message: 'Class not found or you are not enrolled.' });

    const [contents, slots, assignmentCount, quizCount] = await Promise.all([
      prisma.courseContent.findMany({
        where: { classId: enrollment.classId, organizationId: ctx.organizationId },
        orderBy: [{ week: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, body: true, week: true, createdAt: true },
      }),
      prisma.timetableSlot.findMany({
        where: { classId: enrollment.classId, organizationId: ctx.organizationId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      prisma.assignment.count({ where: { classId: enrollment.classId, published: true } }),
      prisma.classQuiz.count({ where: { classId: enrollment.classId } }),
    ]);

    res.json({
      ...toClassCard(enrollment.class),
      contents,
      timetable: slots.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
      })),
      stats: { assignments: assignmentCount, quizzes: quizCount },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load class', error: (err as Error).message });
  }
};

export const listStudentTimetable = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const enrollments = await prisma.classEnrollment.findMany({
      where: { personId: ctx.person.id, class: { organizationId: ctx.organizationId, active: true } },
      select: { classId: true },
    });
    const classIds = enrollments.map((item) => item.classId);
    const slots = await prisma.timetableSlot.findMany({
      where: { organizationId: ctx.organizationId, classId: { in: classIds } },
      include: { class: { select: { name: true, code: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(
      slots.map((slot) => ({
        id: slot.id,
        classId: slot.classId,
        className: slot.class.name,
        classCode: slot.class.code,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load timetable', error: (err as Error).message });
  }
};

export const listStudentAssignments = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const classId = String(req.query.classId || '').trim();
    const enrollments = await prisma.classEnrollment.findMany({
      where: { personId: ctx.person.id, class: { organizationId: ctx.organizationId, active: true } },
      select: { classId: true },
    });
    const classIds = enrollments.map((item) => item.classId).filter((id) => !classId || id === classId);

    const items = await prisma.assignment.findMany({
      where: { organizationId: ctx.organizationId, classId: { in: classIds }, published: true },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        class: { select: { name: true, code: true } },
        submissions: { where: { personId: ctx.person.id }, take: 1 },
      },
    });
    res.json(items.map(toAssignment));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load assignments', error: (err as Error).message });
  }
};

export const getStudentAssignment = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const item = await prisma.assignment.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, published: true },
      include: {
        class: { select: { name: true, code: true } },
        submissions: { where: { personId: ctx.person.id }, take: 1 },
      },
    });
    if (!item) return res.status(404).json({ message: 'Assignment not found' });
    const enrolled = await studentEnrolledInClass(ctx.person.id, item.classId, ctx.organizationId);
    if (!enrolled) return res.status(403).json({ message: 'You are not enrolled in this class.' });
    res.json(toAssignment(item));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load assignment', error: (err as Error).message });
  }
};

export const submitStudentAssignment = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const assignment = await prisma.assignment.findFirst({
      where: { id: req.params.id, organizationId: ctx.organizationId, published: true },
    });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    const enrolled = await studentEnrolledInClass(ctx.person.id, assignment.classId, ctx.organizationId);
    if (!enrolled) return res.status(403).json({ message: 'You are not enrolled in this class.' });

    const body = String(req.body.body || '').trim();
    const parsedFile = parseAssignmentFileUpload(req.body);
    if (parsedFile && 'error' in parsedFile) {
      return res.status(400).json({ message: parsedFile.error });
    }
    if (!body && !parsedFile) {
      return res.status(400).json({ message: 'Upload a PDF or Word file, or add submission notes.' });
    }

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_personId: { assignmentId: assignment.id, personId: ctx.person.id } },
    });

    let fileUrl = existing?.fileUrl || '';
    let fileName = existing?.fileName || '';
    let fileMime = existing?.fileMime || '';
    let fileSize = existing?.fileSize || 0;

    if (parsedFile) {
      const stored = await storeAssignmentSubmissionFile({
        organizationId: ctx.organizationId,
        assignmentId: assignment.id,
        personId: ctx.person.id,
        buffer: parsedFile.buffer,
        mime: parsedFile.mime,
        name: parsedFile.name,
      });
      fileUrl = stored.url;
      fileName = stored.name;
      fileMime = stored.mime;
      fileSize = stored.size;
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_personId: { assignmentId: assignment.id, personId: ctx.person.id } },
      create: {
        organizationId: ctx.organizationId,
        assignmentId: assignment.id,
        personId: ctx.person.id,
        body,
        fileUrl,
        fileName,
        fileMime,
        fileSize,
      },
      update: {
        body,
        fileUrl,
        fileName,
        fileMime,
        fileSize,
        submittedAt: new Date(),
        marksObtained: null,
        feedback: '',
        gradedAt: null,
      },
    });

    res.status(201).json({
      id: submission.id,
      assignmentId: submission.assignmentId,
      body: submission.body,
      file: toSubmissionFile(submission),
      submittedAt: submission.submittedAt,
      status: 'submitted',
    });
  } catch (err) {
    res.status(400).json({ message: 'Failed to submit assignment', error: (err as Error).message });
  }
};

export const listStudentQuizzes = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const classId = String(req.query.classId || '').trim();
    const enrollments = await prisma.classEnrollment.findMany({
      where: { personId: ctx.person.id, class: { organizationId: ctx.organizationId, active: true } },
      select: { classId: true },
    });
    const classIds = enrollments.map((item) => item.classId).filter((id) => !classId || id === classId);

    const quizzes = await prisma.classQuiz.findMany({
      where: { organizationId: ctx.organizationId, classId: { in: classIds } },
      orderBy: [{ quizDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        class: { select: { name: true, code: true } },
        marks: { where: { personId: ctx.person.id }, take: 1 },
      },
    });

    res.json(
      quizzes.map((quiz) => {
        const mark = quiz.marks[0];
        return {
          id: quiz.id,
          classId: quiz.classId,
          className: quiz.class.name,
          classCode: quiz.class.code,
          title: quiz.title,
          quizDate: quiz.quizDate?.toISOString().slice(0, 10) || null,
          maxMarks: quiz.maxMarks,
          notes: quiz.notes,
          marksObtained: mark?.marksObtained ?? null,
          grade: gradeFor(mark?.marksObtained ?? null, quiz.maxMarks),
          feedback: mark?.notes || '',
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load quizzes', error: (err as Error).message });
  }
};

export const listStudentExamMarks = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const enrollments = await prisma.classEnrollment.findMany({
      where: { personId: ctx.person.id, class: { organizationId: ctx.organizationId, active: true } },
      select: { classId: true },
    });
    const classIds = enrollments.map((item) => item.classId);

    const exams = await prisma.exam.findMany({
      where: { organizationId: ctx.organizationId, active: true, classId: { in: classIds } },
      orderBy: [{ examDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        class: { select: { name: true, code: true } },
        marks: { where: { personId: ctx.person.id }, take: 1 },
      },
    });

    res.json(
      exams.map((exam) => {
        const mark = exam.marks[0];
        return {
          id: exam.id,
          title: exam.title,
          className: exam.class?.name,
          classCode: exam.class?.code,
          examDate: exam.examDate?.toISOString().slice(0, 10) || null,
          maxMarks: exam.maxMarks,
          marksObtained: mark?.marksObtained ?? null,
          grade: mark?.grade || gradeFor(mark?.marksObtained ?? null, exam.maxMarks),
          notes: mark?.notes || '',
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load exam marks', error: (err as Error).message });
  }
};

export const listStudentAttendance = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });

    const [daily, sessions] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { organizationId: ctx.organizationId, personId: ctx.person.id },
        orderBy: { date: 'desc' },
        take: 60,
      }),
      prisma.sessionAttendance.findMany({
        where: { personId: ctx.person.id, session: { organizationId: ctx.organizationId } },
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: {
          session: {
            select: {
              date: true,
              class: { select: { name: true, code: true } },
            },
          },
        },
      }),
    ]);

    res.json({
      daily: daily.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        status: row.status,
        notes: row.notes,
      })),
      sessions: sessions.map((row) => ({
        date: row.session.date.toISOString().slice(0, 10),
        className: row.session.class.name,
        classCode: row.session.class.code,
        status: row.status,
        markedAt: row.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load attendance', error: (err as Error).message });
  }
};

export const listStudentLeaves = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });
    const classId = String(req.query.classId || '').trim();
    const items = await prisma.studentLeaveRequest.findMany({
      where: {
        organizationId: ctx.organizationId,
        personId: ctx.person.id,
        ...(classId ? { classId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        class: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
      },
    });
    res.json(items.map(toStudentLeave));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load leave requests', error: (err as Error).message });
  }
};

export const submitStudentLeave = async (req: Request, res: Response) => {
  try {
    const ctx = await requireStudentPerson(req);
    if ('error' in ctx) return res.status(403).json({ message: ctx.error });

    const classId = String(req.body.classId || '').trim();
    const type = parseLeaveType(req.body.type);
    const startDate = parseDay(req.body.startDate);
    const endDate = parseDay(req.body.endDate);
    if (!classId) return res.status(400).json({ message: 'Choose a class for this leave request.' });
    if (!type) return res.status(400).json({ message: 'Choose sick, casual, maternity, or annual leave.' });
    if (!startDate || !endDate) return res.status(400).json({ message: 'Start and end dates are required.' });
    if (endDate < startDate) return res.status(400).json({ message: 'End date cannot be before start date.' });

    const enrollment = await studentEnrolledInClass(ctx.person.id, classId, ctx.organizationId);
    if (!enrollment) return res.status(404).json({ message: 'Class not found or you are not enrolled.' });
    if (!enrollment.class.teacherId) {
      return res.status(400).json({ message: 'This class has no assigned teacher yet. Contact administration.' });
    }

    const leave = await prisma.studentLeaveRequest.create({
      data: {
        organizationId: ctx.organizationId,
        personId: ctx.person.id,
        classId,
        teacherId: enrollment.class.teacherId,
        type,
        startDate,
        endDate,
        reason: String(req.body.reason || '').trim(),
      },
      include: {
        class: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, name: true } },
      },
    });

    const days = leaveDayCount(startDate, endDate);
    await createNotification({
      userId: enrollment.class.teacherId,
      organizationId: ctx.organizationId,
      type: 'student_leave_submitted',
      title: 'Student leave request',
      body: `${ctx.person.name || ctx.user.name} requested ${type} leave for ${enrollment.class.name} (${days} day${days === 1 ? '' : 's'}).`,
      data: { leaveId: leave.id, classId, personId: ctx.person.id },
    });

    res.status(201).json(toStudentLeave(leave));
  } catch (err) {
    res.status(400).json({ message: 'Failed to submit leave request', error: (err as Error).message });
  }
};

export const listStudentNotifications = async (req: Request, res: Response) => {
  try {
    const organizationId = orgId(req);
    if (!organizationId || !req.user) return res.status(403).json({ message: 'Account is not linked to an organisation.' });
    const items = await prisma.notification.findMany({
      where: { userId: req.user.id, organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(
      items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        data: item.data,
        readAt: item.readAt,
        createdAt: item.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load notifications', error: (err as Error).message });
  }
};
