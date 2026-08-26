export const SUSPENDED_COPY = 'Your services are suspended. Please contact the service provider.';

export const isLockedOrg = (org) => Boolean(org?.servicesLocked || org?.status === 'suspended');

export const isSuspendedError = (err) => err?.response?.data?.code === 'SERVICES_SUSPENDED';
