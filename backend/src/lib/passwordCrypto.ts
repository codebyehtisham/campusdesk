import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';

let cachedKeys: { publicKey: string; privateKey: string } | null = null;

const loadKeys = () => {
  if (cachedKeys) return cachedKeys;

  const privatePem = process.env.PASSWORD_ENCRYPTION_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const publicPem = process.env.PASSWORD_ENCRYPTION_PUBLIC_KEY?.replace(/\\n/g, '\n').trim();

  if (privatePem) {
    const publicKey =
      publicPem ||
      crypto.createPublicKey(privatePem).export({ type: 'spki', format: 'pem' }).toString();
    cachedKeys = { privateKey: privatePem, publicKey };
    return cachedKeys;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  cachedKeys = { publicKey, privateKey };
  if (!process.env.PASSWORD_ENCRYPTION_PRIVATE_KEY) {
    console.warn(
      '[password-crypto] PASSWORD_ENCRYPTION_PRIVATE_KEY is not set — using an ephemeral RSA key (passwords fail after server restart).'
    );
  }
  return cachedKeys;
};

export const passwordEncryptionVersion = () => 1;

export const getPasswordPublicKey = () => loadKeys().publicKey;

export const isEncryptedPassword = (value: string) => value.startsWith(PREFIX);

export const decryptClientPassword = (value: string) => {
  if (!isEncryptedPassword(value)) return value;
  const payload = value.slice(PREFIX.length);
  const buffer = Buffer.from(payload, 'base64');
  const decrypted = crypto.privateDecrypt(
    {
      key: loadKeys().privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  );
  return decrypted.toString('utf8');
};
