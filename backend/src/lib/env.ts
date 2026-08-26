export type AppEnvironment = 'development' | 'production';

export function appEnvironment(): AppEnvironment {
  return process.env.APP_ENV === 'development' ? 'development' : 'production';
}

export function publicAppUrl(): string | null {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (domain) return `https://${domain}`;

  return null;
}
