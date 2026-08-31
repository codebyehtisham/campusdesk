const PASSWORD_FIELDS = new Set(['password', 'currentPassword', 'newPassword']);

let cachedPublicKey: string | null = null;
let cachedVersion = 1;

const pemToArrayBuffer = (pem: string) => {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export async function loadPasswordPublicKey(force = false) {
  if (cachedPublicKey && !force) return cachedPublicKey;
  const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5050/api' : '/api');
  const res = await fetch(`${baseURL}/auth/password-key`);
  if (!res.ok) throw new Error('Could not load password encryption key.');
  const data = await res.json();
  cachedPublicKey = String(data.publicKey || '');
  cachedVersion = Number(data.version) || 1;
  if (!cachedPublicKey) throw new Error('Password encryption key missing.');
  return cachedPublicKey;
}

async function importPublicKey(pem: string) {
  return crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

export async function encryptPasswordValue(plain: string) {
  if (!plain) return plain;
  const pem = await loadPasswordPublicKey();
  const key = await importPublicKey(pem);
  const encoded = new TextEncoder().encode(plain);
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
  const bytes = new Uint8Array(encrypted);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `enc:v${cachedVersion}:${btoa(binary)}`;
}

export async function encryptPasswordPayload<T extends Record<string, unknown>>(payload: T): Promise<T> {
  const next: Record<string, unknown> = { ...payload };
  await Promise.all(
    Object.keys(next).map(async (key) => {
      if (!PASSWORD_FIELDS.has(key)) return;
      const value = next[key];
      if (typeof value !== 'string' || !value.trim()) return;
      if (value.startsWith('enc:v')) return;
      next[key] = await encryptPasswordValue(value.trim());
    })
  );
  return next as T;
}
