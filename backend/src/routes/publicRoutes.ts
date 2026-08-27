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
  adminOnly,
} from '../middleware/auth.js';

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
staffRoutes.put('/password', protect, requireActiveOrg, staffOnly, requireModule('faculty'), changePassword);
staffRoutes.get('/teaching', ...teaching, getTeaching);
staffRoutes.post('/classes/:id/content', ...teaching, createContent);
staffRoutes.put('/content/:id', ...teaching, updateContent);
staffRoutes.delete('/content/:id', ...teaching, deleteContent);
staffRoutes.post('/classes/:id/sessions', ...teaching, openSession);
staffRoutes.get('/sessions/:id', ...teaching, getSession);
staffRoutes.put('/sessions/:id/qr', ...teaching, refreshQr);
staffRoutes.put('/sessions/:id/marks', ...teaching, markSession);
staffRoutes.put('/sessions/:id/close', ...teaching, closeSession);

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
careerRoutes.post('/', protect, requireActiveOrg, adminOnly, requireModule('careers'), createOpening);
careerRoutes.put('/:id', protect, requireActiveOrg, adminOnly, requireModule('careers'), updateOpening);
careerRoutes.delete('/:id', protect, requireActiveOrg, adminOnly, requireModule('careers'), deleteOpening);

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
