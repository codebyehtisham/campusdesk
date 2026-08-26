const KEY = 'explore.applicant';

export function getApplicant() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function signInApplicant(applicant) {
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      id: applicant.id,
      name: applicant.name || '',
      email: applicant.email,
      token: applicant.token,
      organization: applicant.organization || null,
      signedInAt: Date.now(),
    })
  );
}

export function signOutApplicant() {
  sessionStorage.removeItem(KEY);
}
