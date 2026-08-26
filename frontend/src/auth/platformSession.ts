const KEY = 'explore.platform';

export function getPlatform() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token && parsed.role === 'superadmin' ? parsed : null;
  } catch {
    return null;
  }
}

export function signInPlatform(account) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      id: account.id,
      name: account.name || '',
      email: account.email,
      role: 'superadmin',
      token: account.token,
      signedInAt: Date.now(),
    })
  );
}

export function signOutPlatform() {
  sessionStorage.removeItem(KEY);
}
