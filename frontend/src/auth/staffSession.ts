const KEY = 'explore.staff';

export function getStaff() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function signInStaff(staff) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      id: staff.id,
      name: staff.name || '',
      email: staff.email,
      role: staff.role,
      token: staff.token,
      organization: staff.organization || null,
      modules: staff.organization?.modules || staff.modules || [],
      signedInAt: Date.now(),
    })
  );
}

export function signOutStaff() {
  sessionStorage.removeItem(KEY);
}
