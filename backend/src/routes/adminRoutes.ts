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
import { getSchemeDesk, listUnits, createUnit, updateUnit, deleteUnit } from '../controllers/unitsController.js';
import { protect, adminOnly, requireActiveOrg, requireOrgLinked, requireModule } from '../middleware/auth.js';

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
router.put('/brand', ...orgAdmin, updateBrand);
router.post('/brand/logo', ...orgAdmin, saveLogo);
router.get('/scheme', ...orgAdmin, getSchemeDesk);
router.get('/units', ...orgAdmin, listUnits);
router.post('/units', ...orgAdmin, createUnit);
router.put('/units/:id', ...orgAdmin, updateUnit);
router.delete('/units/:id', ...orgAdmin, deleteUnit);
router.get('/attendance', ...orgAdmin, listAttendance);
router.put('/attendance', ...orgAdmin, saveAttendanceDay);
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

export default router;

