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
  suspendOrganization,
  activateOrganization,
  archiveOrganization,
  cloneOrganization,
  listOrganizationEvents,
  getOrganizationUsage,
  listUsageFleet,
} from '../controllers/platformLifecycleController.js';
import {
  getFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  listOrgFeatureFlags,
  setOrgFeatureOverride,
} from '../controllers/featureFlagController.js';
import { getTrialSettings, updateTrialSettings, convertTrialOrganization } from '../controllers/trialController.js';
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
router.get('/trial-settings', ...gate, getTrialSettings);
router.put('/trial-settings', ...gate, updateTrialSettings);
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
router.post('/organizations/:id/suspend', ...gate, suspendOrganization);
router.post('/organizations/:id/activate', ...gate, activateOrganization);
router.post('/organizations/:id/archive', ...gate, archiveOrganization);
router.post('/organizations/:id/clone', ...gate, cloneOrganization);
router.post('/organizations/:id/convert-trial', ...gate, convertTrialOrganization);
router.get('/organizations/:id/events', ...gate, listOrganizationEvents);
router.get('/organizations/:id/usage', ...gate, getOrganizationUsage);
router.get('/organizations/:id/feature-flags', ...gate, listOrgFeatureFlags);
router.put('/organizations/:id/feature-flags/:key', ...gate, setOrgFeatureOverride);
router.get('/usage', ...gate, listUsageFleet);
router.get('/feature-flags', ...gate, getFeatureFlags);
router.post('/feature-flags', ...gate, createFeatureFlag);
router.put('/feature-flags/:id', ...gate, updateFeatureFlag);
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
