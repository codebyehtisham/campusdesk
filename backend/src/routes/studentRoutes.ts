import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  studentDashboard,
  studentProfile,
  listStudentClasses,
  getStudentClass,
  listStudentTimetable,
  listStudentAssignments,
  getStudentAssignment,
  submitStudentAssignment,
  listStudentQuizzes,
  listStudentExamMarks,
  listStudentAttendance,
  listStudentLeaves,
  submitStudentLeave,
  listStudentNotifications,
} from '../controllers/studentLmsController.js';
import { protect, applicantOnly, requireActiveOrg, requireModule } from '../middleware/auth.js';
import { findStudentPerson } from '../lib/studentContext.js';
import { prisma } from '../config/db.js';

export const studentRoutes = Router();

const studentGate = [protect, requireActiveOrg, applicantOnly, requireModule('faculty')];

const enrolledStudentOnly = async (req: Request, res: Response, next: NextFunction) => {
  const person = await findStudentPerson(req.user!);
  if (!person) {
    return res.status(403).json({
      code: 'CLASS_NOT_ASSIGNED',
      message: 'No student profile found. Ask your campus admin to enroll you in a class.',
    });
  }
  const enrollment = await prisma.classEnrollment.findFirst({ where: { personId: person.id }, select: { id: true } });
  if (!enrollment) {
    return res.status(403).json({
      code: 'CLASS_NOT_ASSIGNED',
      message: 'You are not enrolled in any class yet.',
    });
  }
  return next();
};

const lms = [...studentGate, enrolledStudentOnly];

studentRoutes.get('/dashboard', ...lms, studentDashboard);
studentRoutes.get('/me', ...lms, studentProfile);
studentRoutes.get('/classes', ...lms, listStudentClasses);
studentRoutes.get('/classes/:classId', ...lms, getStudentClass);
studentRoutes.get('/timetable', ...lms, listStudentTimetable);
studentRoutes.get('/assignments', ...lms, listStudentAssignments);
studentRoutes.get('/assignments/:id', ...lms, getStudentAssignment);
studentRoutes.post('/assignments/:id/submit', ...lms, submitStudentAssignment);
studentRoutes.get('/quizzes', ...lms, listStudentQuizzes);
studentRoutes.get('/exams', ...lms, listStudentExamMarks);
studentRoutes.get('/attendance', ...lms, listStudentAttendance);
studentRoutes.get('/leaves', ...lms, listStudentLeaves);
studentRoutes.post('/leaves', ...lms, submitStudentLeave);
studentRoutes.get('/notifications', ...studentGate, listStudentNotifications);

export default studentRoutes;
