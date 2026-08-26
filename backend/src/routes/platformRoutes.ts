import { Router } from 'express';
import { loginPlatform, getMe, changePassword } from '../controllers/authController.js';
import {
  platformDashboard,
  listCatalog,
  listDepartments,
  createDepartment,
  updateDepartment,
  listModules,
  createModule,
  updateModule,
  listOrganizations,
  createOrganization,
  updateOrganization,
  getOrganization,
  createOrgAdmin,
  setOrgAdminBlocked,
  setOrgAdminPassword,
} from '../controllers/platformController.js';
import { listPlatformAudit, getPlatformAudit } from '../controllers/auditController.js';
import {
  listPlans,
  getBillingOverview,
  getOrgBilling,
  upsertOrgSubscription,
  createOrgInvoice,
  updateOrgInvoice,
  generateOrgInvoice,
} from '../controllers/billingController.js';
import { protect, platformOnly } from '../middleware/auth.js';

const router = Router();
const gate = [protect, platformOnly];

router.post('/login', loginPlatform);
router.get('/me', ...gate, getMe);
router.put('/password', ...gate, changePassword);
router.get('/dashboard', ...gate, platformDashboard);
router.get('/catalog', ...gate, listCatalog);
router.get('/departments', ...gate, listDepartments);
router.post('/departments', ...gate, createDepartment);
router.put('/departments/:id', ...gate, updateDepartment);
router.get('/modules', ...gate, listModules);
router.post('/modules', ...gate, createModule);
router.put('/modules/:id', ...gate, updateModule);
router.get('/organizations', ...gate, listOrganizations);
router.post('/organizations', ...gate, createOrganization);
router.get('/organizations/:id', ...gate, getOrganization);
router.put('/organizations/:id', ...gate, updateOrganization);
router.post('/organizations/:id/admins', ...gate, createOrgAdmin);
router.put('/organizations/:id/admins/:adminId/block', ...gate, setOrgAdminBlocked);
router.put('/organizations/:id/admins/:adminId/password', ...gate, setOrgAdminPassword);
router.get('/plans', ...gate, listPlans);
router.get('/billing', ...gate, getBillingOverview);
router.get('/organizations/:id/billing', ...gate, getOrgBilling);
router.put('/organizations/:id/subscription', ...gate, upsertOrgSubscription);
router.post('/organizations/:id/invoices', ...gate, createOrgInvoice);
router.post('/organizations/:id/invoices/generate', ...gate, generateOrgInvoice);
router.put('/organizations/:id/invoices/:invoiceId', ...gate, updateOrgInvoice);
router.get('/audit', ...gate, listPlatformAudit);
router.get('/audit/:id', ...gate, getPlatformAudit);

export default router;
