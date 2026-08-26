const KEY = 'explore.admin';

export function getAdmin() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token && parsed.role === 'admin' ? parsed : null;
  } catch {
    return null;
  }
}

export function signInAdmin(admin) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      id: admin.id,
      name: admin.name || '',
      email: admin.email,
      role: admin.role || 'admin',
      token: admin.token,
      organization: admin.organization || null,
      modules: admin.organization?.modules || admin.modules || [],
      signedInAt: Date.now(),
    })
  );
}

export function signOutAdmin() {
  sessionStorage.removeItem(KEY);
}

export function orgHasModule(slug) {
  const admin = getAdmin();
  return Boolean(admin?.modules?.includes(slug));
}
