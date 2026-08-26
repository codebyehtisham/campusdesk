import type { Organization, Role, User } from '@prisma/client';

export type AuthedUser = User;

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      organization?: Organization | null;
    }
  }
}

export type AuthPayload = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    blocked: boolean;
    organization: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    kind?: string;
    title?: string;
    tagline?: string;
    logo?: string;
    status: string;
    modules: string[];
    email?: string;
    suspendOnOverdue?: boolean;
    servicesLocked?: boolean;
    lockReason?: string | null;
    overdue?: boolean;
  } | null;
  attendanceLocationEnabled?: boolean;
  campusLocation?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
};

export {};
