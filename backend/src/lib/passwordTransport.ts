import { decryptClientPassword, isEncryptedPassword } from './passwordCrypto.js';

export class PasswordTransportError extends Error {
  constructor(message = 'Could not decrypt password. Refresh the page and try again.') {
    super(message);
    this.name = 'PasswordTransportError';
  }
}

/** Decode a password sent from the client (RSA-OAEP) or plain text during migration. */
export const plaintextPassword = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (isEncryptedPassword(raw)) {
    try {
      return decryptClientPassword(raw);
    } catch {
      throw new PasswordTransportError();
    }
  }

  if (process.env.REQUIRE_ENCRYPTED_PASSWORDS === '1') {
    throw new PasswordTransportError('Password must be sent encrypted.');
  }

  return raw;
};

export const handlePasswordTransportError = (res: { status: (code: number) => { json: (body: unknown) => void } }, err: unknown) => {
  if (err instanceof PasswordTransportError) {
    res.status(400).json({ message: err.message });
    return true;
  }
  return false;
};
