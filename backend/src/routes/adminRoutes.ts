import { Router } from 'express';
import { loginAdmin, getMe, changePassword } from '../controllers/authController.js';
import { getDashboard } from '../controllers/dashboardController.js';
import { listUsers, createUser, updateUser, deleteUser, setUserBlocked, setUserPassword } from '../controllers/usersController.js';
import { updateSettings } from '../controllers/settingsController.js';
import {
  listAttendance,
  createAttendancePerson,
  updateAttendancePerson,
  deleteAttendancePerson,
  saveAttendanceDay,
} from '../controllers/attendanceController.js';
import {
  getAttendanceLocation,
  updateAttendanceLocation,
} from '../controllers/attendanceLocationController.js';
import { getAdminSession, listAdminSessions } from '../controllers/studentAttendanceController.js';
import {
  getAttendanceAnalyticsMeta,
  getAttendanceByClassDate,
  getAttendanceClassAnalytics,
  getAttendanceStudentAnalytics,
} from '../controllers/attendanceAnalyticsController.js';
import {
  getTeachingAdmin,
  createClass,
  updateClass,
  deleteClass,
  setEnrollments,
  createSlot,
  updateSlot,
  deleteSlot,
} from '../controllers/academicController.js';
import { updateBrand, saveLogo } from '../controllers/brandController.js';
import { getAdminAdmissionForm, saveAdminAdmissionForm } from '../controllers/admissionFormController.js';
import { getSchemeDesk, listUnits, createUnit, updateUnit, deleteUnit } from '../controllers/unitsController.js';
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
import { protect, adminOnly, requireActiveOrg, requireOrgLinked, requireModule, financeAccess, examsAccess, libraryAccess } from '../middleware/auth.js';

const router = Router();
const orgAdmin = [protect, requireActiveOrg, adminOnly];

router.post('/login', loginAdmin);
router.get('/me', protect, requireOrgLinked, adminOnly, getMe);
router.put('/password', ...orgAdmin, changePassword);
router.get('/dashboard', ...orgAdmin, getDashboard);
router.get('/users', ...orgAdmin, requireModule('faculty'), listUsers);
router.post('/users', ...orgAdmin, requireModule('faculty'), createUser);
router.put('/users/:id/block', ...orgAdmin, requireModule('faculty'), setUserBlocked);
router.put('/users/:id/password', ...orgAdmin, requireModule('faculty'), setUserPassword);
router.put('/users/:id', ...orgAdmin, requireModule('faculty'), updateUser);
router.delete('/users/:id', ...orgAdmin, requireModule('faculty'), deleteUser);
router.put('/settings', ...orgAdmin, requireModule('admissions'), updateSettings);
router.get('/admission-form', ...orgAdmin, requireModule('admissions'), getAdminAdmissionForm);
router.put('/admission-form', ...orgAdmin, requireModule('admissions'), saveAdminAdmissionForm);
router.put('/brand', ...orgAdmin, updateBrand);
router.post('/brand/logo', ...orgAdmin, saveLogo);
router.get('/scheme', ...orgAdmin, getSchemeDesk);
router.get('/units', ...orgAdmin, listUnits);
router.post('/units', ...orgAdmin, createUnit);
router.put('/units/:id', ...orgAdmin, updateUnit);
router.delete('/units/:id', ...orgAdmin, deleteUnit);
router.get('/attendance', ...orgAdmin, listAttendance);
router.put('/attendance', ...orgAdmin, saveAttendanceDay);
router.get('/attendance/location', ...orgAdmin, requireModule('student-attendance'), getAttendanceLocation);
router.put('/attendance/location', ...orgAdmin, requireModule('student-attendance'), updateAttendanceLocation);
router.get('/attendance/sessions', ...orgAdmin, requireModule('student-attendance'), listAdminSessions);
router.get('/attendance/sessions/:id', ...orgAdmin, requireModule('student-attendance'), getAdminSession);
router.get('/attendance/analytics/meta', ...orgAdmin, requireModule('student-attendance'), getAttendanceAnalyticsMeta);
router.get('/attendance/analytics/by-class-date', ...orgAdmin, requireModule('student-attendance'), getAttendanceByClassDate);
router.get('/attendance/analytics/student/:personId', ...orgAdmin, requireModule('student-attendance'), getAttendanceStudentAnalytics);
router.get('/attendance/analytics/class/:classId', ...orgAdmin, requireModule('student-attendance'), getAttendanceClassAnalytics);
router.post('/attendance/people', ...orgAdmin, createAttendancePerson);
router.put('/attendance/people/:id', ...orgAdmin, updateAttendancePerson);
router.delete('/attendance/people/:id', ...orgAdmin, deleteAttendancePerson);
router.get('/teaching', ...orgAdmin, requireModule('faculty'), getTeachingAdmin);
router.post('/classes', ...orgAdmin, requireModule('faculty'), createClass);
router.put('/classes/:id', ...orgAdmin, requireModule('faculty'), updateClass);
router.delete('/classes/:id', ...orgAdmin, requireModule('faculty'), deleteClass);
router.put('/classes/:id/enrollments', ...orgAdmin, requireModule('faculty'), setEnrollments);
router.post('/timetable', ...orgAdmin, requireModule('faculty'), createSlot);
router.put('/timetable/:id', ...orgAdmin, requireModule('faculty'), updateSlot);
router.delete('/timetable/:id', ...orgAdmin, requireModule('faculty'), deleteSlot);

const financeAdmin = [...orgAdmin, financeAccess, requireModule('fees')];
router.get('/finance/overview', ...financeAdmin, getFinanceOverview);
router.get('/finance/plans', ...financeAdmin, listFeePlans);
router.post('/finance/plans', ...financeAdmin, createFeePlan);
router.put('/finance/plans/:id', ...financeAdmin, updateFeePlan);
router.get('/finance/students', ...financeAdmin, listFinanceStudents);
router.get('/finance/fees', ...financeAdmin, listStudentFees);
router.post('/finance/fees', ...financeAdmin, createStudentFee);
router.post('/finance/payments', ...financeAdmin, recordFeePayment);

const examsAdmin = [...orgAdmin, examsAccess, requireModule('examinations')];
router.get('/exams/classes', ...examsAdmin, listExamClasses);
router.get('/exams', ...examsAdmin, listExams);
router.post('/exams', ...examsAdmin, createExam);
router.put('/exams/:id', ...examsAdmin, updateExam);
router.get('/exams/:id/marks', ...examsAdmin, getExamMarks);
router.put('/exams/:id/marks', ...examsAdmin, saveExamMarks);

const libraryAdmin = [...orgAdmin, libraryAccess, requireModule('library')];
router.get('/library/items', ...libraryAdmin, listLibraryItems);
router.post('/library/items', ...libraryAdmin, createLibraryItem);
router.put('/library/items/:id', ...libraryAdmin, updateLibraryItem);
router.get('/library/loans', ...libraryAdmin, listLibraryLoans);
router.post('/library/loans', ...libraryAdmin, issueLibraryLoan);
router.put('/library/loans/:id/return', ...libraryAdmin, returnLibraryLoan);
router.get('/library/members', ...libraryAdmin, listLibraryMembers);

export default router;

