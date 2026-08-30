import {
  ASSIGNABLE_STAFF_ROLES,
  canDecideAdmissionsRole,
  canViewAdmissionsRole,
  isTeacherRole,
  normalizeStaffRole,
  PORTAL_SLUGS,
  type PortalSlug,
  portalForRole,
  staffRoleDef,
  STAFF_ROLE_DEFS,
  PORTAL_PATHS,
} from '../lib/roles.js';
import { sellableModules } from '../lib/tenant.js';
import type { Organization } from '@prisma/client';

export {
  ASSIGNABLE_STAFF_ROLES,
  canDecideAdmissionsRole,
  canViewAdmissionsRole,
  isTeacherRole,
  normalizeStaffRole,
  portalForRole,
  staffRoleDef,
  STAFF_ROLE_DEFS,
  PORTAL_PATHS,
  type PortalSlug,
};

export const parsePortalSlug = (value: unknown): PortalSlug | null => {
  const portal = String(value || '').trim();
  return PORTAL_SLUGS.includes(portal as PortalSlug) ? (portal as PortalSlug) : null;
};

export const portalLoginAllowed = (role: string, portal: PortalSlug, org: Organization | null) => {
  const def = staffRoleDef(role);
  if (!def || def.portal !== portal) {
    return { ok: false, message: 'This account uses a different staff portal. Check the sign-in link from your administrator.' };
  }
  const modules = sellableModules(org?.modules);
  if (def.requiredModule && !modules.includes(def.requiredModule)) {
    return { ok: false, message: 'This portal is not included in your organisation subscription.' };
  }
  return { ok: true, message: null };
};

export const publicRoleCatalog = () =>
  STAFF_ROLE_DEFS.map((item) => ({
    role: item.role,
    label: item.label,
    hint: item.hint,
    portal: item.portal,
    portalPath: PORTAL_PATHS[item.portal],
    requiredModule: item.requiredModule || null,
  }));
