const KEY = 'explore.applicant';

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function getApplicant() {
  try {
    const store = storage();
    if (!store) return null;
    // Migrate older tab-only sessions so returning applicants stay signed in.
    const legacy = sessionStorage.getItem(KEY);
    if (legacy && !store.getItem(KEY)) {
      store.setItem(KEY, legacy);
      sessionStorage.removeItem(KEY);
    }
    const raw = store.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function signInApplicant(applicant) {
  const store = storage();
  if (!store) return;
  const payload = JSON.stringify({
    id: applicant.id,
    name: applicant.name || '',
    email: applicant.email,
    token: applicant.token,
    organization: applicant.organization || null,
    signedInAt: Date.now(),
  });
  store.setItem(KEY, payload);
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function signOutApplicant() {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
