import { Router } from 'express';
import { registerApplicant, loginApplicant, selectApplicantInstitute, getMe, loginStaff, changePassword } from '../controllers/authController.js';
import { scanStudentAttendance } from '../controllers/studentAttendanceController.js';
import { getMine, saveMine, submitMine, listAll, getOne, decide, streamApplicationFile, replaceApplicationFile } from '../controllers/applicationController.js';
import {
  getPublicAdmissionForm,
  listAdmissionInstitutes,
  uploadApplicationFile,
} from '../controllers/admissionFormController.js';
import { getOpenings, createOpening, updateOpening, deleteOpening } from '../controllers/careerController.js';
import { getPublicSettings } from '../controllers/settingsController.js';
import {
  getAllFaculty,
  getFacultyById,
  getAllCourses,
  getCourseById,
  getAllNews,
  submitContact,
  getAllContacts,
} from '../controllers/contentController.js';
import {
  getTeaching,
  createContent,
  updateContent,
  deleteContent,
  openSession,
  getSession,
  refreshQr,
  markSession,
  closeSession,
} from '../controllers/teachingController.js';
import {
  protect,
  applicantOnly,
  staffOnly,
  teacherOnly,
  canViewAdmissions,
  canDecideAdmissions,
  requireActiveOrg,
  requireOrgLinked,
  requireModule,
  careersManager,
  hrManagerOnly,
  accountantOnly,
  examControllerOnly,
  librarianOnly,
  financeAccess,
  examsAccess,
  libraryAccess,
} from '../middleware/auth.js';
import {
  listAttendance,
  createAttendancePerson,
  updateAttendancePerson,
  deleteAttendancePerson,
  saveAttendanceDay,
} from '../controllers/attendanceController.js';
import { getSchemeDesk } from '../controllers/unitsController.js';
import {
  getFinanceOverview,
  listFeePlans,
  createFeePlan,
  updateFeePlan,
  listStudentFees,
  createStudentFee,
  recordFeePayment,
  listFinanceStudents,
} from '../controllers/financeController.js';
import {
  listExams,
  createExam,
  updateExam,
  getExamMarks,
  saveExamMarks,
  listExamClasses,
} from '../controllers/examController.js';
import {
  listLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  listLibraryLoans,
  issueLibraryLoan,
  returnLibraryLoan,
  listLibraryMembers,
} from '../controllers/libraryController.js';
import {
  listMyLeaves,
  submitLeave,
  getMyLeaveBalance,
  listHrLeaves,
  getHrLeave,
  decideLeave,
  listHrLeaveQuotas,
  upsertHrLeaveQuota,
  hrAttendanceCalendar,
} from '../controllers/leaveController.js';
import {
  listNotifications,
  unreadNotificationCount,
  getNotification,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';

export const authRoutes = Router();
authRoutes.post('/register', registerApplicant);
authRoutes.post('/login', loginApplicant);
authRoutes.post('/select-institute', protect, applicantOnly, selectApplicantInstitute);
authRoutes.get('/me', protect, applicantOnly, getMe);
authRoutes.post(
  '/attendance/scan',
  protect,
  requireActiveOrg,
  applicantOnly,
  requireModule('student-attendance'),
  scanStudentAttendance
);

export const staffRoutes = Router();
const teaching = [protect, requireActiveOrg, staffOnly, teacherOnly, requireModule('faculty')];

staffRoutes.post('/login', loginStaff);
staffRoutes.get('/me', protect, requireOrgLinked, staffOnly, getMe);
staffRoutes.put('/password', protect, requireActiveOrg, staffOnly, changePassword);

const staffNotify = [protect, requireOrgLinked, staffOnly];
staffRoutes.get('/notifications', ...staffNotify, listNotifications);
staffRoutes.get('/notifications/unread-count', ...staffNotify, unreadNotificationCount);
staffRoutes.get('/notifications/:id', ...staffNotify, getNotification);
staffRoutes.put('/notifications/:id/read', ...staffNotify, markNotificationRead);
staffRoutes.put('/notifications/read-all', ...staffNotify, markAllNotificationsRead);

const staffLeave = [protect, requireActiveOrg, staffOnly];
staffRoutes.get('/leaves/balance', ...staffLeave, getMyLeaveBalance);
staffRoutes.get('/leaves', ...staffLeave, listMyLeaves);
staffRoutes.post('/leaves', ...staffLeave, submitLeave);

staffRoutes.get('/teaching', ...teaching, getTeaching);
staffRoutes.post('/classes/:id/content', ...teaching, createContent);
staffRoutes.put('/content/:id', ...teaching, updateContent);
staffRoutes.delete('/content/:id', ...teaching, deleteContent);
staffRoutes.post('/classes/:id/sessions', ...teaching, openSession);
staffRoutes.get('/sessions/:id', ...teaching, getSession);
staffRoutes.put('/sessions/:id/qr', ...teaching, refreshQr);
staffRoutes.put('/sessions/:id/marks', ...teaching, markSession);
staffRoutes.put('/sessions/:id/close', ...teaching, closeSession);

const hrStaff = [protect, requireActiveOrg, staffOnly, hrManagerOnly];
staffRoutes.get('/hr/scheme', ...hrStaff, getSchemeDesk);
staffRoutes.get('/hr/attendance', ...hrStaff, requireModule('staff-attendance'), listAttendance);
staffRoutes.put('/hr/attendance', ...hrStaff, requireModule('staff-attendance'), saveAttendanceDay);
staffRoutes.post('/hr/attendance/people', ...hrStaff, requireModule('staff-attendance'), createAttendancePerson);
staffRoutes.put('/hr/attendance/people/:id', ...hrStaff, requireModule('staff-attendance'), updateAttendancePerson);
staffRoutes.delete('/hr/attendance/people/:id', ...hrStaff, requireModule('staff-attendance'), deleteAttendancePerson);
staffRoutes.get('/hr/leaves', ...hrStaff, listHrLeaves);
staffRoutes.get('/hr/leaves/:id', ...hrStaff, getHrLeave);
staffRoutes.put('/hr/leaves/:id/decision', ...hrStaff, decideLeave);
staffRoutes.get('/hr/leave-quotas', ...hrStaff, listHrLeaveQuotas);
staffRoutes.put('/hr/leave-quotas/:userId', ...hrStaff, upsertHrLeaveQuota);
staffRoutes.get('/hr/attendance/calendar', ...hrStaff, requireModule('staff-attendance'), hrAttendanceCalendar);

const financeStaff = [protect, requireActiveOrg, staffOnly, accountantOnly, requireModule('fees')];
staffRoutes.get('/finance/overview', ...financeStaff, getFinanceOverview);
staffRoutes.get('/finance/plans', ...financeStaff, listFeePlans);
staffRoutes.post('/finance/plans', ...financeStaff, createFeePlan);
staffRoutes.put('/finance/plans/:id', ...financeStaff, updateFeePlan);
staffRoutes.get('/finance/students', ...financeStaff, listFinanceStudents);
staffRoutes.get('/finance/fees', ...financeStaff, listStudentFees);
staffRoutes.post('/finance/fees', ...financeStaff, createStudentFee);
staffRoutes.post('/finance/payments', ...financeStaff, recordFeePayment);

const examsStaff = [protect, requireActiveOrg, staffOnly, examControllerOnly, requireModule('examinations')];
staffRoutes.get('/exams/classes', ...examsStaff, listExamClasses);
staffRoutes.get('/exams', ...examsStaff, listExams);
staffRoutes.post('/exams', ...examsStaff, createExam);
staffRoutes.put('/exams/:id', ...examsStaff, updateExam);
staffRoutes.get('/exams/:id/marks', ...examsStaff, getExamMarks);
staffRoutes.put('/exams/:id/marks', ...examsStaff, saveExamMarks);

const libraryStaff = [protect, requireActiveOrg, staffOnly, librarianOnly, requireModule('library')];
staffRoutes.get('/library/items', ...libraryStaff, listLibraryItems);
staffRoutes.post('/library/items', ...libraryStaff, createLibraryItem);
staffRoutes.put('/library/items/:id', ...libraryStaff, updateLibraryItem);
staffRoutes.get('/library/loans', ...libraryStaff, listLibraryLoans);
staffRoutes.post('/library/loans', ...libraryStaff, issueLibraryLoan);
staffRoutes.put('/library/loans/:id/return', ...libraryStaff, returnLibraryLoan);
staffRoutes.get('/library/members', ...libraryStaff, listLibraryMembers);

export const applicationRoutes = Router();
applicationRoutes.get('/me', protect, requireActiveOrg, applicantOnly, requireModule('admissions'), getMine);
applicationRoutes.put('/me', protect, requireActiveOrg, applicantOnly, requireModule('admissions'), saveMine);
applicationRoutes.post('/me/submit', protect, requireActiveOrg, applicantOnly, requireModule('admissions'), submitMine);
applicationRoutes.post(
  '/me/files',
  protect,
  requireActiveOrg,
  applicantOnly,
  requireModule('admissions'),
  uploadApplicationFile
);
applicationRoutes.get('/', protect, requireActiveOrg, canViewAdmissions, requireModule('admissions'), listAll);
applicationRoutes.get(
  '/:id/files/:fieldKey',
  protect,
  requireActiveOrg,
  canViewAdmissions,
  requireModule('admissions'),
  streamApplicationFile
);
applicationRoutes.post(
  '/:id/files/:fieldKey',
  protect,
  requireActiveOrg,
  canViewAdmissions,
  requireModule('admissions'),
  replaceApplicationFile
);
applicationRoutes.get('/:id', protect, requireActiveOrg, canViewAdmissions, requireModule('admissions'), getOne);
applicationRoutes.patch(
  '/:id/decision',
  protect,
  requireActiveOrg,
  canDecideAdmissions,
  requireModule('admissions'),
  decide
);

export const instituteRoutes = Router();
instituteRoutes.get('/', listAdmissionInstitutes);

export const admissionFormRoutes = Router();
admissionFormRoutes.get('/', getPublicAdmissionForm);

export const careerRoutes = Router();
careerRoutes.get('/', getOpenings);
careerRoutes.post('/', protect, requireActiveOrg, careersManager, requireModule('careers'), createOpening);
careerRoutes.put('/:id', protect, requireActiveOrg, careersManager, requireModule('careers'), updateOpening);
careerRoutes.delete('/:id', protect, requireActiveOrg, careersManager, requireModule('careers'), deleteOpening);

export const settingsRoutes = Router();
settingsRoutes.get('/', getPublicSettings);

export const facultyRoutes = Router();
facultyRoutes.get('/', getAllFaculty);
facultyRoutes.get('/:id', getFacultyById);

export const courseRoutes = Router();
courseRoutes.get('/', getAllCourses);
courseRoutes.get('/:id', getCourseById);

export const newsRoutes = Router();
newsRoutes.get('/', getAllNews);

export const contactRoutes = Router();
contactRoutes.post('/', submitContact);
contactRoutes.get('/', getAllContacts);
